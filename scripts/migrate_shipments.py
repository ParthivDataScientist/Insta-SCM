"""
Idempotent SQLite shipment schema sync.

Usage:
    .\\venv\\Scripts\\python.exe scripts\\migrate_shipments.py
"""

from __future__ import annotations

import sqlite3
from pathlib import Path
import os
import sys

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from app.core.config import settings


def _sqlite_db_path() -> Path:
    url = settings.DATABASE_URL
    if not url.startswith("sqlite:///"):
        raise RuntimeError(f"This migration only supports SQLite. DATABASE_URL={url}")
    return Path(url.replace("sqlite:///", "", 1))


def run() -> None:
    db_path = _sqlite_db_path()
    print(f"Using SQLite DB: {db_path}")

    with sqlite3.connect(db_path) as conn:
        cur = conn.cursor()
        cur.execute("PRAGMA table_info(shipment)")
        existing_columns = {row[1] for row in cur.fetchall()}

        required_columns: list[tuple[str, str]] = [
            ("master_tracking_number", "VARCHAR"),
            ("is_master", "BOOLEAN DEFAULT 0"),
            ("child_tracking_numbers", "JSON"),
            ("child_parcels", "JSON"),
            ("is_archived", "BOOLEAN DEFAULT 0"),
            ("cs", "VARCHAR"),
            ("no_of_box", "VARCHAR"),
            ("project_id", "INTEGER"),
            ("booking_date", "VARCHAR"),
            ("show_city", "VARCHAR"),
            ("cs_type", "VARCHAR"),
            ("remarks", "VARCHAR"),
            ("last_scan_date", "VARCHAR"),
        ]

        added = 0
        for column_name, column_type in required_columns:
            if column_name in existing_columns:
                continue
            statement = f"ALTER TABLE shipment ADD COLUMN {column_name} {column_type}"
            print(f"Adding column: {column_name}")
            cur.execute(statement)
            added += 1

        conn.commit()

    if added:
        print(f"Shipment migration complete. Added {added} column(s).")
    else:
        print("Shipment migration complete. No changes needed.")


if __name__ == "__main__":
    run()
