import sqlite3
import os

DB_PATH = 'sql_app.db'

if os.path.exists(DB_PATH):
    print(f"Connecting to {DB_PATH}...")
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    try:
        print("Dropping 'dashboardproject' table to force schema update...")
        cursor.execute("DROP TABLE IF EXISTS dashboardproject;")
        conn.commit()
        print("Successfully dropped dashboardproject table.")
    except Exception as e:
        print(f"Error: {e}")
    finally:
        conn.close()
else:
    print(f"Database {DB_PATH} not found.")
