"""Minimal read-only MySQL access for real-data extraction."""

from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Any, Iterable

REQUIRED_COLUMNS = {
    "service_tickets": {"id", "status", "actual_repair_completed_at", "branch_id", "customer_device_id"},
    "repair_items": {"service_ticket_id", "approval_status", "warranty_source_item_id", "warranty_remedy", "warranty_replacement_catalog_id", "approval_decision_at", "created_at"},
    "assignments": {"service_ticket_id", "technician_id", "assigned_at", "ended_at"},
    "service_status_histories": {"service_ticket_id", "from_status", "to_status", "changed_at"},
    "service_time_estimate_histories": {"service_ticket_id", "reason", "created_at"},
    "transfers": {"from_assignment_id", "status"},
}


@dataclass(frozen=True)
class DatabaseConfig:
    host: str
    port: int
    name: str
    user: str
    password: str

    @classmethod
    def from_environment(cls) -> "DatabaseConfig":
        missing = [name for name in ("DB_HOST", "DB_NAME", "DB_USER", "DB_PASSWORD") if not os.getenv(name)]
        if missing:
            raise ValueError("Missing database environment variables: " + ", ".join(missing))
        try:
            port = int(os.getenv("DB_PORT", "3306"))
        except ValueError as exc:
            raise ValueError("DB_PORT must be an integer") from exc
        return cls(os.environ["DB_HOST"], port, os.environ["DB_NAME"], os.environ["DB_USER"], os.environ["DB_PASSWORD"])


def _select(cursor: Any, sql: str, parameters: Iterable[Any] | None = None) -> list[dict]:
    if not sql.lstrip().upper().startswith("SELECT"):
        raise ValueError("Real-data bridge only permits SELECT statements")
    cursor.execute(sql, tuple(parameters or ()))
    return list(cursor.fetchall())


def _where_ids(ids: list[int]) -> tuple[str, tuple[int, ...]]:
    return ",".join(["%s"] * len(ids)), tuple(ids)


def _verify_schema(cursor: Any, database_name: str) -> None:
    table_names = sorted(REQUIRED_COLUMNS)
    placeholders = ",".join(["%s"] * len(table_names))
    rows = _select(cursor, f"""
        SELECT table_name, column_name
        FROM information_schema.columns
        WHERE table_schema = %s AND table_name IN ({placeholders})
    """, (database_name, *table_names))
    available: dict[str, set[str]] = {}
    for row in rows:
        # PyMySQL preserves INFORMATION_SCHEMA's uppercase labels on some servers.
        table = row.get("table_name", row.get("TABLE_NAME"))
        column = row.get("column_name", row.get("COLUMN_NAME"))
        available.setdefault(str(table), set()).add(str(column))
    missing = {
        table: sorted(columns - available.get(table, set()))
        for table, columns in REQUIRED_COLUMNS.items()
        if columns - available.get(table, set())
    }
    if missing:
        details = "; ".join(f"{table}: {', '.join(columns)}" for table, columns in sorted(missing.items()))
        raise RuntimeError("Database schema does not satisfy the Real Data Bridge contract — " + details)


def load_source_snapshot(config: DatabaseConfig, limit: int | None = None) -> list[dict]:
    """Read a consistent, PII-free snapshot and roll the transaction back."""
    try:
        import pymysql
    except ImportError as exc:  # pragma: no cover - exercised by CLI environment
        raise RuntimeError("PyMySQL is required. Run: pip install -r ml/requirements.txt") from exc

    connection = pymysql.connect(
        host=config.host,
        port=config.port,
        user=config.user,
        password=config.password,
        database=config.name,
        charset="utf8mb4",
        autocommit=False,
        cursorclass=pymysql.cursors.DictCursor,
        connect_timeout=10,
        read_timeout=60,
    )
    try:
        with connection.cursor() as cursor:
            cursor.execute("SET SESSION TRANSACTION READ ONLY")
            cursor.execute("START TRANSACTION READ ONLY")
            _verify_schema(cursor, config.name)
            ticket_sql = """
                SELECT st.id AS ticket_id, st.status AS ticket_status,
                       st.received_at, st.actual_repair_completed_at,
                       st.branch_id, dm.name AS device_model,
                       dt.name AS device_type
                FROM service_tickets st
                JOIN customer_devices cd ON cd.id = st.customer_device_id
                JOIN device_models dm ON dm.id = cd.device_model_id
                JOIN device_types dt ON dt.id = dm.device_type_id
                WHERE st.actual_repair_completed_at IS NOT NULL
                  AND st.status IN ('WAITING_HANDOVER', 'HANDED_OVER')
                ORDER BY st.id
            """
            parameters: tuple[Any, ...] = ()
            if limit is not None:
                if limit < 0:
                    raise ValueError("limit must be non-negative")
                ticket_sql += " LIMIT %s"
                parameters = (limit,)
            tickets = _select(cursor, ticket_sql, parameters)
            if not tickets:
                return []
            ids = [int(row["ticket_id"]) for row in tickets]
            placeholders, id_params = _where_ids(ids)

            items = _select(cursor, f"""
                SELECT ri.id AS repair_item_id, ri.service_ticket_id,
                       ri.approval_status, ri.warranty_source_item_id,
                       ri.warranty_remedy AS item_warranty_remedy,
                       ri.warranty_decision, ri.approval_decision_at,
                       ri.created_at AS item_created_at,
                       sci.id AS catalog_id, sci.name AS catalog_name,
                       sci.standard_duration_minutes,
                       sci.warranty_remedy AS catalog_warranty_remedy,
                       stype.code AS service_type_code,
                       si.id AS issue_id, si.name AS service_issue,
                       wr.id AS replacement_catalog_id,
                       wr.name AS replacement_catalog_name,
                       wr.standard_duration_minutes AS replacement_standard_duration,
                       wrt.code AS replacement_service_type_code
                FROM repair_items ri
                LEFT JOIN service_catalog_items sci ON sci.id = ri.service_catalog_item_id
                LEFT JOIN service_types stype ON stype.id = sci.service_type_id
                LEFT JOIN service_issues si ON si.id = sci.service_issue_id
                LEFT JOIN service_catalog_items wr ON wr.id = ri.warranty_replacement_catalog_id
                LEFT JOIN service_types wrt ON wrt.id = wr.service_type_id
                WHERE ri.service_ticket_id IN ({placeholders})
                ORDER BY ri.service_ticket_id, ri.id
            """, id_params)
            assignments = _select(cursor, f"""
                SELECT id AS assignment_id, service_ticket_id, technician_id,
                       status AS assignment_status, assigned_at, ended_at
                FROM assignments
                WHERE service_ticket_id IN ({placeholders})
                ORDER BY service_ticket_id, assigned_at, id
            """, id_params)
            transfers = _select(cursor, f"""
                SELECT tr.id AS transfer_id, a.service_ticket_id, tr.status AS transfer_status
                FROM transfers tr
                JOIN assignments a ON a.id = tr.from_assignment_id
                WHERE a.service_ticket_id IN ({placeholders})
                ORDER BY a.service_ticket_id, tr.id
            """, id_params)
            histories = _select(cursor, f"""
                SELECT id AS history_id, service_ticket_id, from_status,
                       to_status, changed_at
                FROM service_status_histories
                WHERE service_ticket_id IN ({placeholders})
                ORDER BY service_ticket_id, changed_at, id
            """, id_params)
            plan_changes = _select(cursor, f"""
                SELECT service_ticket_id, created_at
                FROM service_time_estimate_histories
                WHERE service_ticket_id IN ({placeholders})
                  AND reason = 'SERVICE_PLAN_CHANGE'
                ORDER BY service_ticket_id, created_at, id
            """, id_params)
        grouped = {int(row["ticket_id"]): {**row, "repair_items": [], "assignments": [], "transfers": [], "histories": [], "plan_changes": []} for row in tickets}
        for collection, key in ((items, "repair_items"), (assignments, "assignments"), (transfers, "transfers"), (histories, "histories"), (plan_changes, "plan_changes")):
            for row in collection:
                ticket_id = int(row["service_ticket_id"])
                if ticket_id in grouped:
                    grouped[ticket_id][key].append(row)
        return list(grouped.values())
    finally:
        connection.rollback()
        connection.close()
