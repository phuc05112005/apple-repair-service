#!/usr/bin/env python3
"""Print a stable digest of MySQL table checksums without reading row content."""

from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path

import pymysql

ML_ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ML_ROOT / "src"))
from repair_duration_data.db import DatabaseConfig


def main() -> int:
    config = DatabaseConfig.from_environment()
    connection = pymysql.connect(host=config.host, port=config.port, user=config.user, password=config.password,
        database=config.name, charset="utf8mb4", autocommit=False, cursorclass=pymysql.cursors.DictCursor)
    try:
        with connection.cursor() as cursor:
            cursor.execute("SHOW TABLES")
            tables = sorted(str(next(iter(row.values()))) for row in cursor.fetchall())
            values = []
            for table in tables:
                cursor.execute(f"CHECKSUM TABLE `{table}`")
                result = cursor.fetchone()
                values.append((table, result.get("Checksum")))
        payload = json.dumps(values, separators=(",", ":"), ensure_ascii=True).encode()
        print(json.dumps({"table_count": len(tables), "checksum_digest": hashlib.sha256(payload).hexdigest().upper()}))
        return 0
    finally:
        connection.rollback()
        connection.close()


if __name__ == "__main__":
    raise SystemExit(main())
