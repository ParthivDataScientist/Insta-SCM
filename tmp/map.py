import sqlite3
import sys

try:
    conn = sqlite3.connect('sql_app.db')
    c = conn.cursor()

    # Map users (project managers)
    users = c.execute('SELECT id, full_name FROM user WHERE role=\'PROJECT_MANAGER\'').fetchall()
    print(f'Found {len(users)} users')
    for uid, name in users:
        print(f'Mapping PM: {name} (ID: {uid})')
        c.execute('UPDATE dashboardproject SET manager_id = ? WHERE project_manager = ?', (uid, name))

    # Map clients
    clients_str = c.execute('SELECT DISTINCT client FROM dashboardproject WHERE client IS NOT NULL').fetchall()
    for row in clients_str:
        c_name = row[0]
        client_row = c.execute('SELECT id FROM client WHERE name=?', (c_name,)).fetchone()
        if client_row:
            cid = client_row[0]
        else:
            c.execute('INSERT INTO client (name) VALUES (?)', (c_name,))
            cid = c.lastrowid
        c.execute('UPDATE dashboardproject SET client_id = ? WHERE client = ?', (cid, c_name))

    # Make sure timestamps are migrated
    conn.commit()
    print('Relation mapping complete.')
except Exception as e:
    print(f"Error: {e}")
