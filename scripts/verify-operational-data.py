"""Read-only verification for operational master data in the canonical database."""

from __future__ import annotations

import json
import os
import sys
from decimal import Decimal
from pathlib import Path

import pymysql


if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")


DATABASE = os.getenv("DB_NAME", "apple_repair_service")
OUTPUT = Path(os.getenv("OUTPUT_PATH", "target/operational-data/database-verification.json"))
TRANSACTION_TABLES = [
    "customers",
    "customer_devices",
    "appointments",
    "appointment_devices",
    "appointment_service_items",
    "service_tickets",
    "repair_items",
    "assignments",
    "part_usages",
    "inventory_lots",
    "inventory_transactions",
    "service_feedbacks",
    "service_interruptions",
    "service_status_histories",
    "service_time_estimate_histories",
    "transfers",
    "defective_part_returns",
    "ml_predictions",
]


def rows(cursor, sql: str, parameters=None):
    if parameters is None:
        cursor.execute(sql)
    else:
        cursor.execute(sql, parameters)
    return cursor.fetchall()


connection = pymysql.connect(
    host=os.getenv("DB_HOST", "127.0.0.1"),
    port=int(os.getenv("DB_PORT", "3307")),
    user=os.environ["DB_USER"],
    password=os.environ["DB_PASSWORD"],
    database=DATABASE,
    charset="utf8mb4",
    cursorclass=pymysql.cursors.DictCursor,
    autocommit=False,
)


def json_default(value):
    if isinstance(value, Decimal):
        return int(value)
    raise TypeError(f"Unsupported JSON value: {type(value).__name__}")


try:
    with connection.cursor() as cursor:
        table_count = rows(cursor, "SELECT COUNT(*) AS value FROM information_schema.tables WHERE table_schema=%s", (DATABASE,))[0]["value"]
        column_count = rows(cursor, "SELECT COUNT(*) AS value FROM information_schema.columns WHERE table_schema=%s", (DATABASE,))[0]["value"]
        model_counts = rows(cursor, """
            SELECT dt.name AS device_type, COUNT(dm.id) AS model_count
            FROM device_types dt LEFT JOIN device_models dm ON dm.device_type_id=dt.id
            GROUP BY dt.id, dt.name ORDER BY dt.name
        """)
        account_counts = rows(cursor, "SELECT role, status, COUNT(*) AS count FROM users GROUP BY role, status ORDER BY role, status")
        operational_accounts = rows(cursor, """
            SELECT COUNT(*) AS count,
                   SUM(password_hash LIKE '$2%%') AS bcrypt_count,
                   COUNT(DISTINCT username) AS unique_usernames
            FROM users WHERE username REGEXP '^ktv(0[1-9]|10)$'
        """)[0]
        branch_distribution = rows(cursor, """
            SELECT b.name AS branch, COUNT(DISTINCT ts.technician_id) AS technician_count
            FROM technician_schedules ts JOIN users u ON u.id=ts.technician_id
            JOIN branches b ON b.id=ts.branch_id
            WHERE u.username REGEXP '^ktv(0[1-9]|10)$'
            GROUP BY b.id, b.name ORDER BY b.id
        """)
        schedule_count = rows(cursor, """
            SELECT COUNT(*) AS count FROM technician_schedules ts JOIN users u ON u.id=ts.technician_id
            WHERE u.username REGEXP '^ktv(0[1-9]|10)$'
        """)[0]["count"]
        schedule_overlaps = rows(cursor, """
            SELECT COUNT(*) AS count FROM technician_schedules a
            JOIN technician_schedules b ON a.id < b.id AND a.technician_id=b.technician_id
              AND a.work_date=b.work_date AND a.start_time < b.end_time AND b.start_time < a.end_time
            JOIN users u ON u.id=a.technician_id WHERE u.username REGEXP '^ktv(0[1-9]|10)$'
        """)[0]["count"]
        text_values = rows(cursor, """
            SELECT name AS value FROM device_models
            UNION ALL SELECT full_name AS value FROM users
        """)
        mojibake_markers = ("Ã", "Â", "â€", "Ä", "Æ")
        malformed_unicode = sum(
            any(marker in (item["value"] or "") for marker in mojibake_markers)
            for item in text_values
        )
        duplicate_models = rows(cursor, """
            SELECT COUNT(*) AS count FROM (
              SELECT device_type_id, LOWER(name) FROM device_models GROUP BY device_type_id, LOWER(name) HAVING COUNT(*) > 1
            ) duplicated
        """)[0]["count"]
        transaction_counts = {}
        transaction_checksums = {}
        for table in TRANSACTION_TABLES:
            transaction_counts[table] = rows(cursor, f"SELECT COUNT(*) AS count FROM `{table}`")[0]["count"]
            cursor.execute(f"CHECKSUM TABLE `{table}`")
            checksum_row = cursor.fetchone()
            transaction_checksums[table] = checksum_row.get("Checksum")
        catalog_coverage = rows(cursor, """
            SELECT COUNT(DISTINCT dm.id) AS models_with_catalog, COUNT(sci.id) AS catalog_items
            FROM device_models dm LEFT JOIN service_catalog_items sci ON sci.device_model_id=dm.id
            WHERE sci.id IS NOT NULL
        """)[0]

    result = {
        "schema": {"database": DATABASE, "tables": table_count, "columns": column_count},
        "modelCounts": model_counts,
        "accountCounts": account_counts,
        "operationalTechnicians": operational_accounts,
        "branchDistribution": branch_distribution,
        "operationalScheduleCount": schedule_count,
        "scheduleOverlapCount": schedule_overlaps,
        "malformedUnicodeCount": malformed_unicode,
        "duplicateModelCount": duplicate_models,
        "catalogCoverage": catalog_coverage,
        "transactionCounts": transaction_counts,
        "transactionChecksums": transaction_checksums,
        "readOnly": True,
    }
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(result, ensure_ascii=False, indent=2, default=json_default), encoding="utf-8")
    print(json.dumps(result, ensure_ascii=False, indent=2, default=json_default))
finally:
    connection.rollback()
    connection.close()
