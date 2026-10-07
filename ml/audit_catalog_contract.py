#!/usr/bin/env python3
"""Read-only canonical schema/catalog audit for the Option A contract."""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

import pymysql

ML_ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ML_ROOT / "src"))
from repair_duration_data.catalog import normalize_catalog_service_label
from repair_duration_data.db import DatabaseConfig


def main() -> int:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    config = DatabaseConfig.from_environment()
    vocabulary = json.loads((ML_ROOT / "models/experimental/category_vocabulary.json").read_text(encoding="utf-8"))
    trained = set(vocabulary["catalog_service"])
    connection = pymysql.connect(host=config.host, port=config.port, user=config.user, password=config.password,
        database=config.name, charset="utf8mb4", autocommit=False, cursorclass=pymysql.cursors.DictCursor)
    try:
        with connection.cursor() as cursor:
            cursor.execute("SET SESSION TRANSACTION READ ONLY")
            cursor.execute("START TRANSACTION READ ONLY")
            cursor.execute("SELECT COUNT(DISTINCT table_name) AS table_count, COUNT(*) AS column_count FROM information_schema.columns WHERE table_schema=DATABASE()")
            schema = cursor.fetchone()
            cursor.execute("SELECT id, name FROM service_catalog_items ORDER BY id")
            rows = list(cursor.fetchall())
        labels = [normalize_catalog_service_label(row["name"]) for row in rows]
        collisions = len(labels) - len(set(labels))
        seen = sum(label in trained for label in labels)
        print(json.dumps({"schema": schema, "catalog_rows": len(rows), "unique_names": len(set(labels)),
            "collision_count": collisions, "training_vocabulary_size": len(trained), "seen": seen,
            "unseen": len(labels) - seen, "coverage_percent": None if not labels else seen / len(labels) * 100,
            "catalogs": [{"id": row["id"], "name": normalize_catalog_service_label(row["name"]),
                          "familiarity": "SEEN_DURING_TRAINING" if normalize_catalog_service_label(row["name"]) in trained else "UNSEEN_DURING_TRAINING"} for row in rows]}, ensure_ascii=False, indent=2))
        return 2 if collisions else 0
    finally:
        connection.rollback()
        connection.close()


if __name__ == "__main__":
    raise SystemExit(main())
