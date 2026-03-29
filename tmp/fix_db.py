import sys
import os

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from sqlmodel import Session
from app.db.session import engine
from app.main import admin_migrate_allocations

# Manually trigger the migration function
with Session(engine) as session:
    res = admin_migrate_allocations(session)
    print("Migration Result:", res)
