import os
import sys
from typing import List, Type, Any
from sqlmodel import SQLModel, Session, create_engine, select, text
from sqlalchemy.exc import IntegrityError
from datetime import datetime, timezone

# Add the project root to sys.path to import app modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.models.user import User
from app.models.dashboard_project import DashboardProject, Client, ProjectAuditLog
from app.models.shipment import Shipment

# Configuration
LOCAL_DB_URL = "sqlite:///./sql_app.db"
# This will be replaced by the user with their production URL
PROD_DB_URL = "postgresql://neondb_owner:npg_HMkj3n7ozKas@ep-flat-morning-annijs3f-pooler.c-6.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"

if not PROD_DB_URL:
    print("ERROR: PROD_DATABASE_URL environment variable is not set.")
    print("Usage: export PROD_DATABASE_URL='postgresql://...' && python scripts/sync_to_production.py")
    sys.exit(1)

# Engines
local_engine = create_engine(LOCAL_DB_URL)
# connect_args={"sslmode": "require"} is often needed for production DBs like Supabase/Neon
prod_engine = create_engine(PROD_DB_URL, connect_args={"sslmode": "require"} if "postgres" in PROD_DB_URL else {})

def sync_table(model: Type[SQLModel], local_session: Session, prod_session: Session, table_name: str):
    """Appends records to production. Updates if ID exists (Upsert)."""
    print(f"Syncing {table_name} (Append Mode)...")
    
    # 2. Fetch all from local
    items = local_session.exec(select(model)).all()
    print(f"  Found {len(items)} records locally.")
    
    # 3. Upsert to production
    count = 0
    for item in items:
        # merge() checks for existing primary key. 
        # If found, it updates; if not, it inserts.
        prod_session.merge(item)
        count += 1
        if count % 50 == 0:
            print(f"    Processed {count}...")
    
    prod_session.commit()
    print(f"  Successfully synced {table_name}.")

def main():
    print("=== Insta-SCM Production Database Sync (APPEND MODE) ===")
    print(f"Source: {LOCAL_DB_URL}")
    print(f"Target: {'*' * 10}{PROD_DB_URL[-10:] if len(PROD_DB_URL) > 10 else ''}")
    
    try:
        # Test connection first
        with prod_engine.connect() as conn:
            print("Successfully connected to production database!")
            pass
    except Exception as e:
        print("\n[!] CONNECTION ERROR:")
        print(f"Could not connect to the database at: {PROD_DB_URL.split('@')[-1]}")
        print(f"Error Details: {str(e)}")
        if "translate host name" in str(e):
            print("\nTIP: This looks like a DNS (Internet) issue. Check your wifi or if the database host is blocked by a VPN.")
        sys.exit(1)
    
    with Session(local_engine) as local_session:
        with Session(prod_engine) as prod_session:
            # Order is critical for foreign keys
            # 1. Users
            sync_table(User, local_session, prod_session, "user")
            
            # 2. Clients
            sync_table(Client, local_session, prod_session, "client")
            
            # 3. Projects
            sync_table(DashboardProject, local_session, prod_session, "dashboardproject")
            
            # 4. Audit Logs
            sync_table(ProjectAuditLog, local_session, prod_session, "projectauditlog")
            
            # 5. Shipments
            sync_table(Shipment, local_session, prod_session, "shipment")

    print("\n--- Synchronization Complete! ---")
    print("Your production database now matches your local environment.")

if __name__ == "__main__":
    main()
