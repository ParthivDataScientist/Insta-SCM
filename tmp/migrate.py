import sqlite3
import sys
import os

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from app.db.session import engine
from sqlmodel import SQLModel
# Import all models to register metadata
from app.models.dashboard_project import DashboardProject, Client, ProjectAuditLog
from app.models.user import User

print("Running automatic table creation...")
SQLModel.metadata.create_all(engine)

print("Altering dashboardproject table to match new schema...")
conn = sqlite3.connect(os.path.join(os.path.dirname(__file__), '..', 'sql_app.db'))
c = conn.cursor()

def alter_table(query):
    try:
        c.execute(query)
        print(f"Success: {query}")
    except Exception as e:
        print(f"Skipped: {query} -> {e}")

alter_table("ALTER TABLE dashboardproject RENAME COLUMN material_dispatch_date TO dispatch_date")
alter_table("ALTER TABLE dashboardproject ADD COLUMN client_id INTEGER")
alter_table("ALTER TABLE dashboardproject ADD COLUMN manager_id INTEGER")
alter_table("ALTER TABLE dashboardproject ADD COLUMN allocation_start_date DATE")
alter_table("ALTER TABLE dashboardproject ADD COLUMN allocation_end_date DATE")

conn.commit()
conn.close()

print("Schema sync complete.")
