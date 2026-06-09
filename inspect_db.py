import sys
import os
from sqlalchemy import inspect
from sqlmodel import SQLModel, create_engine

# Add current workspace to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.core.config import settings
from app.db.session import engine
# Import all models to register SQLModel metadata
from app.models.user import User
from app.models.dashboard_project import DashboardProject, Client, ProjectAuditLog, ProjectLink, ProjectResource
from app.models.shipment import Shipment

def inspect_neon_schema():
    print(">>> Connecting to Neon PostgreSQL and inspecting physical schema...")
    print(f"    Target Database Host: {settings.DATABASE_URL.split('@')[-1].split('/')[0] if '@' in settings.DATABASE_URL else 'localhost'}")
    inspector = inspect(engine)
    physical_tables = inspector.get_table_names()
    defined_tables = list(SQLModel.metadata.tables.keys())
    print(physical_tables)
    print(defined_tables)
    print("\n--- TABLES SUMMARY ---")
    print(f"Total Physical Tables in Neon: {len(physical_tables)}")
    print(f"Total Code-Defined Models:    {len(defined_tables)}")
    
    extra_tables = [t for t in physical_tables if t not in defined_tables]
    if extra_tables:
        print(f"[!] EXTRA TABLES FOUND (in DB but NOT defined in code): {extra_tables}")
    else:
        print("[OK] No extra or obsolete tables found.")
        
    print("\n--- COLUMN-BY-COLUMN COMPARISON ---")
    
    for table_name in physical_tables:
        if table_name not in defined_tables:
            continue
        #if table_name == "user_tenant":
        print(f"\nAnalyzing Table: '{table_name}'")
        
        # Get physical columns from Neon
        physical_cols = {col["name"]: col["type"] for col in inspector.get_columns(table_name)}
        
        # Get defined columns from python models
        defined_cols = SQLModel.metadata.tables[table_name].columns.keys()
        
        # Check for obsolete columns in DB
        obsolete_cols = []
        for col_name in physical_cols.keys():
            if col_name not in defined_cols:
                obsolete_cols.append(col_name)
                
        # Check for missing columns in DB
        missing_cols = []
        for col_name in defined_cols:
            if col_name not in physical_cols:
                missing_cols.append(col_name)
                
        # Output results
        if not obsolete_cols and not missing_cols:
            print(f"  [OK] Perfect Sync! All {len(physical_cols)} columns match Python models.")
        else:
            if obsolete_cols:
                print(f"  [!] OBSOLETE COLUMNS FOUND in Neon DB (not defined in code, safe to delete):")
                for col in obsolete_cols:
                    print(f"    - '{col}' (Type: {physical_cols[col]})")
            if missing_cols:
                print(f"  [ERROR] MISSING COLUMNS IN Neon DB (defined in code but not in DB):")
                for col in missing_cols:
                    print(f"    - '{col}'")
                    
    print("\n>>> Analysis complete.")

if __name__ == "__main__":
    inspect_neon_schema()
