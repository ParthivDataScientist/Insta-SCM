import sqlite3
import os

db_path = os.path.join("d:\\Desktop\\Insta-Track", "sql_app.db")

try:
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    
    # Check existing columns
    cur.execute("PRAGMA table_info(shipment)")
    columns = [col[1] for col in cur.fetchall()]
    
    if "master_tracking_number" not in columns:
        print("Adding master_tracking_number...")
        cur.execute("ALTER TABLE shipment ADD COLUMN master_tracking_number VARCHAR")
        
    if "is_master" not in columns:
        print("Adding is_master...")
        cur.execute("ALTER TABLE shipment ADD COLUMN is_master BOOLEAN DEFAULT 0")
        
    if "child_tracking_numbers" not in columns:
        print("Adding child_tracking_numbers...")
        cur.execute("ALTER TABLE shipment ADD COLUMN child_tracking_numbers JSON")
        
    conn.commit()
    print("Database altered successfully!")
except Exception as e:
    print(f"Error: {e}")
finally:
    if 'conn' in locals():
        conn.close()
