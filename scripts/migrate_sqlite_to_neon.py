import os
import sqlite3
from sqlmodel import Session, select, create_engine, SQLModel
from app.models.dashboard_project import DashboardProject
from app.models.shipment import Shipment
from app.core.config import settings

# Sources
sqlite_url = "sqlite:///c:/Users/parth/OneDrive/Desktop/Insta-SCM/sql_app.db"
# Target is from settings.DATABASE_URL
target_url = settings.DATABASE_URL

if "sqlite" in target_url:
    print(f"ERROR: Your DATABASE_URL is still pointing to SQLite: {target_url}")
    print("Please update your .env file with your Neon PostgreSQL URL first.")
    exit(1)

print(f"--- MIGRATION START ---")
print(f"Source: {sqlite_url}")
print(f"Target: {target_url}")

# Engines
src_engine = create_engine(sqlite_url)
dst_engine = create_engine(target_url)

# Ensure target schema exists
print("Creating tables in target database...")
SQLModel.metadata.create_all(dst_engine)

# Migrate DashboardProjects
print("Migrating DashboardProjects...")
with Session(src_engine) as src_session:
    projects = src_session.exec(select(DashboardProject)).all()
    print(f"Found {len(projects)} projects in source.")
    
    with Session(dst_engine) as dst_session:
        for p in projects:
            # Create a shallow copy without the ID to allow auto-increment in target
            data = p.model_dump(exclude={"id"})
            new_p = DashboardProject(**data)
            dst_session.add(new_p)
        dst_session.commit()
        print(f"✅ Successfully migrated {len(projects)} projects.")

# Migrate Shipments
print("Migrating Shipments...")
with Session(src_engine) as src_session:
    shipments = src_session.exec(select(Shipment)).all()
    print(f"Found {len(shipments)} shipments in source.")
    
    with Session(dst_engine) as dst_session:
        for s in shipments:
            data = s.model_dump(exclude={"id"})
            new_s = Shipment(**data)
            dst_session.add(new_s)
        dst_session.commit()
        print(f"✅ Successfully migrated {len(shipments)} shipments.")

print("\n--- MIGRATION COMPLETE ---")
