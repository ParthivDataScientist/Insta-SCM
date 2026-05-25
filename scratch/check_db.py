import sqlite3
import os

def check_db(filename):
    print(f"=== {filename} ===")
    if not os.path.exists(filename):
        print("Does not exist")
        return
    try:
        conn = sqlite3.connect(filename)
        cursor = conn.cursor()
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
        tables = [r[0] for r in cursor.fetchall()]
        print("Tables:", tables)
        for t in tables:
            cursor.execute(f"SELECT COUNT(*) FROM {t}")
            count = cursor.fetchone()[0]
            print(f"  Table '{t}' has {count} rows")
            if t == "shipment":
                cursor.execute(f"PRAGMA table_info({t});")
                columns = [c[1] for c in cursor.fetchall()]
                print("  Columns:", columns)
                cursor.execute(f"SELECT id, tracking_number, carrier, status, last_scan_date FROM {t} LIMIT 5")
                for row in cursor.fetchall():
                    print("    Row:", row)
        conn.close()
    except Exception as e:
        print("Error:", e)

check_db("sql_app.db")
check_db("insta_track.db")
