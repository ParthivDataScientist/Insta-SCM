import pandas as pd
from sqlmodel import Session, select
import sys
import os

# Add the app directory to sys.path so we can import modules
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from app.db.session import engine
from app.models.dashboard_project import DashboardProject
from app.models.manager_allocation import ManagerAllocation

def normalize_dates():
    try:
        with Session(engine) as session:
            print("Connecting to DB and fetching projects...")
            projects = session.exec(select(DashboardProject)).all()
            print(f"Found {len(projects)} projects.")
            
            project_counts = 0
            for p in projects:
                changed = False
                for col in ['date', 'event_start_date', 'event_end_date', 'material_dispatch_date', 'installation_start_date', 'installation_end_date', 'dismantling_date']:
                    val = getattr(p, col)
                    # For both string and malformed objects, clean aggressively:
                    if isinstance(val, str):
                        try:
                            dt = pd.to_datetime(val, errors='coerce')
                            if pd.notna(dt):
                                # convert to pure string 'YYYY-MM-DD' which SQLAlchemy py_date accepts happily
                                new_val = dt.date()
                                setattr(p, col, new_val)
                                changed = True
                        except Exception as e:
                            print(f"Failed to parse project date: {val} - {e}")
                
                if changed:
                    session.add(p)
                    project_counts += 1

            session.commit()
            print(f"Successfully normalized and committed {project_counts} projects!")

            print("Fetching allocations...")
            allocs = session.exec(select(ManagerAllocation)).all()
            alloc_counts = 0
            for a in allocs:
                changed = False
                for col in ['allocation_start_date', 'allocation_end_date']:
                    val = getattr(a, col)
                    if isinstance(val, str):
                        try:
                            dt = pd.to_datetime(val, errors='coerce')
                            if pd.notna(dt):
                                new_val = dt.date()
                                setattr(a, col, new_val)
                                changed = True
                        except Exception as e:
                            pass
                if changed:
                    session.add(a)
                    alloc_counts += 1

            session.commit()
            print(f"Successfully normalized and committed {alloc_counts} allocations!")

    except Exception as e:
        print(f"Critical error during migration: {e}")

if __name__ == '__main__':
    normalize_dates()
