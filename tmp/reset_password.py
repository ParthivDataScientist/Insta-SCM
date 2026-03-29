"""
Reset admin user password in the local SQLite database.
Also upgrades the user role to Admin.
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import sqlite3
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

NEW_PASSWORD = "Admin@123"
DB_PATH = "sql_app.db"

if not os.path.exists(DB_PATH):
    print(f"ERROR: {DB_PATH} not found. Run from the project root.")
    sys.exit(1)

conn = sqlite3.connect(DB_PATH)
c = conn.cursor()

# Check current users
c.execute("SELECT id, email, role, is_active FROM user")
users = c.fetchall()
print("Current users:", users)

# Hash the new password
new_hash = pwd_context.hash(NEW_PASSWORD)

# Update all users — set password, role=Admin, is_active=True
c.execute("UPDATE user SET hashed_password=?, role='Admin', is_active=1", (new_hash,))
conn.commit()

print(f"\n✅ Done! All users now have password: {NEW_PASSWORD}")
print("   Role set to: Admin")
print("   is_active set to: True")

c.execute("SELECT id, email, role, is_active FROM user")
print("Updated users:", c.fetchall())
conn.close()
