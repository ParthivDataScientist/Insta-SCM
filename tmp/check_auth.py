import sqlite3
from app.core.auth import verify_password

conn = sqlite3.connect('sql_app.db')
c = conn.cursor()
c.execute('SELECT id, email, hashed_password, role, is_active FROM user')
users = c.fetchall()
conn.close()

print("=== Users in DB ===")
for u in users:
    print(f"ID: {u[0]}, Email: {u[1]}, Role: {u[3]}, Active: {u[4]}")
    # Test some common passwords
    test_passwords = ['admin', 'password', 'admin123', 'Parth@123', 'Insta@123', '123456']
    for pw in test_passwords:
        result = verify_password(pw, u[2])
        if result:
            print(f"  ✅ Password match: '{pw}'")
    print(f"  Hash: {u[2][:40]}...")
