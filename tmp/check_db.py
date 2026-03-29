import sqlite3, os, sys

if not os.path.exists('sql_app.db'):
    print("NO sql_app.db found - app is pointing to the wrong database")
    sys.exit(0)

conn = sqlite3.connect('sql_app.db')
c = conn.cursor()
c.execute("SELECT name FROM sqlite_master WHERE type='table'")
tables = [r[0] for r in c.fetchall()]
print('Tables:', tables)

if 'user' in tables:
    c.execute('SELECT id, email, role, is_active FROM user')
    print('Users:', c.fetchall())
else:
    print('No user table found')

conn.close()
