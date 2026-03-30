import sqlite3
import json
conn = sqlite3.connect('sql_app.db')
columns = [row[1] for row in conn.execute("PRAGMA table_info(dashboardproject)").fetchall()]
print(json.dumps(columns, indent=2))
