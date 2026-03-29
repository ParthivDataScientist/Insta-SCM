import os
import pandas as pd
import math
from sqlmodel import Session, create_engine, select, text, func
from app.models.dashboard_project import DashboardProject
from app.core.config import settings

def reseed_neon():
    # 1. Get Database URL
    db_url = "postgresql://neondb_owner:npg_eFN5gMPjVs8I@ep-bitter-leaf-ai2n4qm6-pooler=require"
    if "sqlite" in db_url:
        print(f"⚠️  Database URL is currently pointing to SQLite: {db_url}")
        print("Please ensure your .env file has the proper Neon DATABASE_URL.")
        # Try to find it in .env manually if settings didn't pick it up
        return

    print(f"🚀 Connecting to Neon: {db_url.split('@')[-1]}") # Print only host for safety

    try:
        engine = create_engine(db_url)
        
        # 2. Erase Data (Truncate)
        with Session(engine) as session:
            print("🧹 Cleaning up dashboardproject table...")
            session.execute(text("TRUNCATE TABLE dashboardproject RESTART IDENTITY CASCADE;"))
            session.commit()
            print("✅ Table cleaned successfully.")

            # 3. Read Excel Data
            root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
            excel_path = os.path.join(root_dir, 'resources', 'Project Pilot sheet.xlsx')
            
            if not os.path.exists(excel_path):
                print(f"❌ Excel file not found at: {excel_path}")
                return

            print(f"📄 Reading data from: {excel_path}")
            df = pd.read_excel(excel_path)
            df = df.where(pd.notnull(df), None)

            def safe_str(val):
                if val is None or (isinstance(val, float) and math.isnan(val)): return None
                if isinstance(val, pd.Timestamp): return val.strftime('%Y-%m-%d')
                s = str(val).strip()
                return s if s else None

            # 4. Insert Data
            print(f"📥 Inserting {len(df)} projects...")
            for _, row in df.iterrows():
                p = DashboardProject(
                    project_name=safe_str(row.get('Project Name', 'Unknown')),
                    event_name=safe_str(row.get('Event Name')),
                    venue=safe_str(row.get('Venue')),
                    area=safe_str(row.get('Area (Sqm)')),
                    event_start_date=safe_str(row.get('Event Start Date')),
                    material_dispatch_date=safe_str(row.get('Material Dispatch Date')),
                    installation_start_date=safe_str(row.get('Installation Start Date')),
                    installation_end_date=safe_str(row.get('Installation End Date')),
                    dismantling_date=safe_str(row.get('Dismantling Date')),
                    project_manager=safe_str(row.get('Project Manager')),
                    team_type=safe_str(row.get('Team Type')),
                    stage=safe_str(row.get('Stage')) or 'Open',
                    branch=safe_str(row.get('Branch'))
                )
                session.add(p)
            
            session.commit()
            print(f"✨ Successfully re-inserted {len(df)} projects into Neon!")

    except Exception as e:
        print(f"❌ Error during reseed: {e}")

if __name__ == "__main__":
    reseed_neon()
