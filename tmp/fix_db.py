import sqlite3
import os

db_path = "./sql_app.db"
if not os.path.exists(db_path):
    print(f"Database {db_path} not found.")
    exit(1)

def fix_db():
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Check current columns
    cursor.execute("PRAGMA table_info(dashboardproject)")
    columns = [col[1] for col in cursor.fetchall()]
    print(f"Current columns: {columns}")
    
    if "client" not in columns:
        try:
            cursor.execute("ALTER TABLE dashboardproject ADD COLUMN client TEXT")
            print("Added column 'client'")
        except Exception as e:
            print(f"Error adding client: {e}")
    else:
        print("Column 'client' already exists")
    
    if "city" not in columns:
        try:
            cursor.execute("ALTER TABLE dashboardproject ADD COLUMN city TEXT")
            print("Added column 'city'")
        except Exception as e:
            print(f"Error adding city: {e}")
    else:
        print("Column 'city' already exists")
        
    conn.commit()
    conn.close()
    print("Database sync complete.")

if __name__ == "__main__":
    fix_db()
