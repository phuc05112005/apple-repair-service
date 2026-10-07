from __future__ import annotations

from typing import Protocol

from repair_duration_data.db import DatabaseConfig, load_source_snapshot
from repair_duration_data.eligibility import evaluate_ticket, resolve_technical_action
from repair_duration_data.feature_builder import build_base_feature_row
from .errors import RuntimeInferenceError
from .schemas import PredictionContext


class RuntimeRepository(Protocol):
    def load_context(self, ticket_id: int) -> PredictionContext: ...
    def validate_candidates(self, technician_ids: list[int]) -> None: ...
    def load_history(self) -> list[dict]: ...
    def ping(self) -> bool: ...


class MySQLRuntimeRepository:
    """Read-only adapter. It never selects customer PII and never writes."""

    def __init__(self, config: DatabaseConfig) -> None:
        self.config = config

    def _connect(self):
        import pymysql
        return pymysql.connect(host=self.config.host, port=self.config.port, user=self.config.user,
            password=self.config.password, database=self.config.name, charset="utf8mb4", autocommit=False,
            cursorclass=pymysql.cursors.DictCursor, connect_timeout=5, read_timeout=30)

    def _read(self, operation):
        connection = self._connect()
        try:
            with connection.cursor() as cursor:
                cursor.execute("SET SESSION TRANSACTION READ ONLY")
                cursor.execute("START TRANSACTION READ ONLY")
                return operation(cursor)
        finally:
            connection.rollback()
            connection.close()

    def ping(self) -> bool:
        try:
            return bool(self._read(lambda cursor: cursor.execute("SELECT 1")))
        except Exception:
            return False

    def load_context(self, ticket_id: int) -> PredictionContext:
        def operation(cursor):
            cursor.execute("""
                SELECT st.id AS ticket_id, st.status AS ticket_status, st.branch_id,
                       dt.name AS device_type, dm.name AS device_model
                FROM service_tickets st
                JOIN customer_devices cd ON cd.id = st.customer_device_id
                JOIN device_models dm ON dm.id = cd.device_model_id
                JOIN device_types dt ON dt.id = dm.device_type_id
                WHERE st.id = %s
            """, (ticket_id,))
            ticket = cursor.fetchone()
            if ticket is None:
                raise RuntimeInferenceError("TICKET_NOT_FOUND", "Service ticket was not found", 404)
            if ticket["ticket_status"] != "WAITING_ASSIGNMENT":
                raise RuntimeInferenceError("TICKET_NOT_READY", "Ticket must be waiting for assignment", 409)
            cursor.execute("""
                SELECT ri.warranty_source_item_id, ri.warranty_remedy AS item_warranty_remedy,
                       sci.id AS catalog_id, sci.name AS catalog_name, sci.standard_duration_minutes,
                       sci.warranty_remedy AS catalog_warranty_remedy, st.code AS service_type_code,
                       si.name AS service_issue, wr.id AS replacement_catalog_id,
                       wr.name AS replacement_catalog_name, wr.standard_duration_minutes AS replacement_standard_duration,
                       wrt.code AS replacement_service_type_code
                FROM repair_items ri
                LEFT JOIN service_catalog_items sci ON sci.id = ri.service_catalog_item_id
                LEFT JOIN service_types st ON st.id = sci.service_type_id
                LEFT JOIN service_issues si ON si.id = sci.service_issue_id
                LEFT JOIN service_catalog_items wr ON wr.id = ri.warranty_replacement_catalog_id
                LEFT JOIN service_types wrt ON wrt.id = wr.service_type_id
                WHERE ri.service_ticket_id = %s AND ri.approval_status = 'APPROVED'
                ORDER BY ri.id
            """, (ticket_id,))
            items = list(cursor.fetchall())
            if len(items) > 1:
                raise RuntimeInferenceError("MULTI_ITEM_NOT_SUPPORTED", "Multiple approved service items are not supported", 409)
            if not items:
                raise RuntimeInferenceError("PLAN_NOT_READY", "Ticket has no approved service item", 409)
            resolved = resolve_technical_action(items[0])
            if resolved is None:
                raise RuntimeInferenceError("PLAN_NOT_READY", "Approved service item has no supported technical action", 409)
            action, catalog_id, catalog_name, standard = resolved
            return PredictionContext(int(ticket["ticket_id"]), str(ticket["device_type"]),
                str(ticket["device_model"]), str(items[0]["service_issue"]), action,
                int(items[0]["warranty_source_item_id"] is not None), catalog_id, catalog_name,
                standard, int(ticket["branch_id"]))
        return self._read(operation)

    def validate_candidates(self, technician_ids: list[int]) -> None:
        def operation(cursor):
            placeholders = ",".join(["%s"] * len(technician_ids))
            cursor.execute(f"SELECT id FROM users WHERE id IN ({placeholders}) AND role='TECHNICIAN' AND status='ACTIVE'", tuple(technician_ids))
            found = {int(row["id"]) for row in cursor.fetchall()}
            missing = [value for value in technician_ids if value not in found]
            if missing:
                raise RuntimeInferenceError("TECHNICIAN_NOT_FOUND", "One or more candidates are not active technicians", 404)
        self._read(operation)

    def load_history(self) -> list[dict]:
        rows: list[dict] = []
        for ticket in load_source_snapshot(self.config):
            sample, _ = evaluate_ticket(ticket)
            if sample is not None:
                rows.append(build_base_feature_row(sample))
        return rows
