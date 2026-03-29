from contextlib import asynccontextmanager

from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import SQLModel, Session, text, select, func

from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from app.core.config import settings
from app.db.session import engine, get_session
from app.api.v1.api import api_router

# Import models so SQLModel can discover them
from app.models.dashboard_project import DashboardProject
from app.models.manager import Manager
from app.models.manager_allocation import ManagerAllocation

limiter = Limiter(key_func=get_remote_address)

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan: create DB tables on startup and safely add new columns."""
    SQLModel.metadata.create_all(engine)

    # 2. Safe manual migrations — each ALTER TABLE is wrapped individually so one failure
    # (column already exists) doesn't block the others.
    migration_stmts = [
        ("exhibition_name",         "ALTER TABLE shipment ADD COLUMN exhibition_name VARCHAR;"),
        ("master_tracking_number",  "ALTER TABLE shipment ADD COLUMN master_tracking_number VARCHAR;"),
        ("is_master",               "ALTER TABLE shipment ADD COLUMN is_master BOOLEAN DEFAULT FALSE;"),
        ("child_tracking_numbers",  "ALTER TABLE shipment ADD COLUMN child_tracking_numbers JSON;"),
        ("child_parcels",           "ALTER TABLE shipment ADD COLUMN child_parcels JSON;"),
        ("is_archived",             "ALTER TABLE shipment ADD COLUMN is_archived BOOLEAN DEFAULT FALSE;"),
        ("cs",                      "ALTER TABLE shipment ADD COLUMN cs VARCHAR;"),
        ("no_of_box",               "ALTER TABLE shipment ADD COLUMN no_of_box VARCHAR;"),
        
        # DashboardProject migrations
        ("event_end_date",          "ALTER TABLE dashboardproject ADD COLUMN event_end_date DATE;"),
        ("material_dispatch_date",  "ALTER TABLE dashboardproject ADD COLUMN material_dispatch_date DATE;"),
        ("installation_start_date", "ALTER TABLE dashboardproject ADD COLUMN installation_start_date DATE;"),
        ("installation_end_date",   "ALTER TABLE dashboardproject ADD COLUMN installation_end_date DATE;"),
        ("dismantling_date",        "ALTER TABLE dashboardproject ADD COLUMN dismantling_date DATE;"),
        ("project_manager",         "ALTER TABLE dashboardproject ADD COLUMN project_manager VARCHAR;"),
        ("team_type",               "ALTER TABLE dashboardproject ADD COLUMN team_type VARCHAR;"),
        ("branch",                  "ALTER TABLE dashboardproject ADD COLUMN branch VARCHAR;"),
        ("board_stage",             "ALTER TABLE dashboardproject ADD COLUMN board_stage VARCHAR;"),
        ("comments",                "ALTER TABLE dashboardproject ADD COLUMN comments JSON;"),
        ("materials",               "ALTER TABLE dashboardproject ADD COLUMN materials JSON;"),
        ("photos",                  "ALTER TABLE dashboardproject ADD COLUMN photos JSON;"),
        ("qc_steps",                "ALTER TABLE dashboardproject ADD COLUMN qc_steps JSON;")
    ]

    with Session(engine) as session:
        for col_name, stmt in migration_stmts:
            try:
                session.execute(text(stmt))
                session.commit()
            except Exception:
                session.rollback()

        # 3. Auto-seed Projects if table is empty
        try:
            from sqlmodel import select, func
            import pandas as pd
            import math
            import os
            from datetime import date
            
            count = session.exec(select(func.count(DashboardProject.id))).one()
            if count == 0:
                print("[seeding] Dashboard table is empty. Starting auto-seed...")
                root_dir = os.path.dirname(os.path.abspath(__file__)) # current dir is app/
                excel_path = os.path.join(os.path.dirname(root_dir), 'resources', 'Project Pilot sheet.xlsx')
                
                if os.path.exists(excel_path):
                    df = pd.read_excel(excel_path)
                    df = df.where(pd.notnull(df), None)

                    def parse_date(val):
                        if val is None or (isinstance(val, float) and math.isnan(val)): 
                            return None
                        try:
                            # Use pandas to handle various formats like '17th March 2026'
                            dt = pd.to_datetime(val, errors='coerce')
                            if pd.isna(dt): return None
                            return dt.date()
                        except Exception:
                            return None

                    def safe_str(val):
                        if val is None or (isinstance(val, float) and math.isnan(val)): return None
                        s = str(val).strip()
                        return s if s else None

                    for _, row in df.iterrows():
                        p = DashboardProject(
                            project_name=safe_str(row.get('Project Name', 'Unknown')),
                            event_name=safe_str(row.get('Event Name')),
                            venue=safe_str(row.get('Venue')),
                            area=safe_str(row.get('Area (Sqm)')),
                            event_start_date=parse_date(row.get('Event Start Date')),
                            event_end_date=parse_date(row.get('Event End Date')),
                            material_dispatch_date=parse_date(row.get('Material Dispatch Date')),
                            installation_start_date=parse_date(row.get('Installation Start Date')),
                            installation_end_date=parse_date(row.get('Installation End Date')),
                            dismantling_date=parse_date(row.get('Dismantling Date')),
                            project_manager=safe_str(row.get('Project Manager')),
                            team_type=safe_str(row.get('Team Type')),
                            stage=safe_str(row.get('Stage')) or 'Open',
                            branch=safe_str(row.get('Branch'))
                        )
                        session.add(p)
                    session.commit()
                    print(f"[seeding] Successfully imported {len(df)} projects.")
                else:
                    print(f"[seeding] Excel file not found at {excel_path}. Skipping.")
        except Exception as e:
            print(f"[seeding] Error during auto-seed: {e}")
            session.rollback()

    yield


app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS — tightly scoped; configure ALLOWED_ORIGIN in .env for production
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        settings.ALLOWED_ORIGIN,
        "http://127.0.0.1:5173",
        "http://localhost:5173",
        "http://192.168.29.50:5173",
        "https://insta-exhibition-scm.vercel.app"  # Added Vercel production origin
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix=settings.API_V1_STR)


@app.get("/api/admin/reseed")
def admin_reseed(session: Session = Depends(get_session)):
    """Secret admin endpoint to wipe and re-seed the project database."""
    try:
        import os
        import pandas as pd
        import math
        from sqlmodel import text

        # 1. Wipe current projects
        print("[admin-reseed] Wiping dashboardproject table...")
        if "sqlite" in str(session.bind.url):
             session.execute(text("DELETE FROM managerallocation;"))
             session.execute(text("DELETE FROM manager;"))
             session.execute(text("DELETE FROM dashboardproject;"))
        else:
             session.execute(text("TRUNCATE TABLE managerallocation RESTART IDENTITY CASCADE;"))
             session.execute(text("TRUNCATE TABLE manager RESTART IDENTITY CASCADE;"))
             session.execute(text("TRUNCATE TABLE dashboardproject RESTART IDENTITY CASCADE;"))
        session.commit()

        # 2. Re-import from Excel
        root_dir = os.path.dirname(os.path.abspath(__file__)) # current dir is app/
        excel_path = os.path.join(os.path.dirname(root_dir), 'resources', 'Project Pilot sheet.xlsx')
        
        if os.path.exists(excel_path):
            df = pd.read_excel(excel_path)
            df = df.where(pd.notnull(df), None)

            def parse_date(val):
                if val is None or (isinstance(val, float) and math.isnan(val)): 
                    return None
                try:
                    dt = pd.to_datetime(val, errors='coerce')
                    if pd.isna(dt): return None
                    return dt.date()
                except Exception:
                    return None

            def safe_str(val):
                if val is None or (isinstance(val, float) and math.isnan(val)): return None
                s = str(val).strip()
                return s if s else None

            managers_map = {}
            for _, row in df.iterrows():
                pm_name = safe_str(row.get('Project Manager')) or "Unassigned"
                if pm_name not in managers_map:
                    new_m = Manager(name=pm_name)
                    session.add(new_m)
                    session.commit()
                    session.refresh(new_m)
                    managers_map[pm_name] = new_m

                p = DashboardProject(
                    project_name=safe_str(row.get('Project Name', 'Unknown')),
                    event_name=safe_str(row.get('Event Name')),
                    venue=safe_str(row.get('Venue')),
                    area=safe_str(row.get('Area (Sqm)')),
                    event_start_date=parse_date(row.get('Event Start Date')),
                    event_end_date=parse_date(row.get('Event End Date')),
                    material_dispatch_date=parse_date(row.get('Material Dispatch Date')),
                    installation_start_date=parse_date(row.get('Installation Start Date')),
                    installation_end_date=parse_date(row.get('Installation End Date')),
                    dismantling_date=parse_date(row.get('Dismantling Date')),
                    project_manager=pm_name,
                    team_type=safe_str(row.get('Team Type')),
                    stage=safe_str(row.get('Stage')) or 'Open',
                    branch=safe_str(row.get('Branch'))
                )
                session.add(p)
                session.commit()
                session.refresh(p)
                
                # Add explicit manager allocation
                start_date = p.material_dispatch_date or p.event_start_date
                if start_date:
                    import datetime
                    end_date = p.dismantling_date or (start_date + datetime.timedelta(days=7))
                    session.add(ManagerAllocation(
                        manager_id=managers_map[pm_name].id,
                        project_id=p.id,
                        allocation_start_date=start_date,
                        allocation_end_date=end_date
                    ))
                    
            session.commit()
            return {"status": "success", "message": f"Wiped and re-seeded {len(df)} projects successfully."}
        else:
            return {"status": "error", "message": f"Excel file not found at {excel_path}."}
    except Exception as e:
        session.rollback()
        return {"status": "error", "message": str(e)}


@app.get("/")
def root():
    return {"message": "Insta-Track API is running", "docs": "/docs"}


@app.get("/api/admin/migrate-allocations")
def admin_migrate_allocations(session: Session = Depends(get_session)):
    try:
        from sqlmodel import SQLModel
        SQLModel.metadata.create_all(engine)
        
        projects = session.exec(select(DashboardProject)).all()
        managers_created = 0
        allocations_created = 0

        for project in projects:
            pm_name = project.project_manager or "Unassigned"
            manager = session.exec(select(Manager).where(Manager.name == pm_name)).first()
            if not manager:
                manager = Manager(name=pm_name)
                session.add(manager)
                session.commit()
                session.refresh(manager)
                managers_created += 1

            start_date = project.material_dispatch_date or project.event_start_date
            if start_date:
                existing_alloc = session.exec(
                    select(ManagerAllocation)
                    .where(ManagerAllocation.manager_id == manager.id)
                    .where(ManagerAllocation.project_id == project.id)
                ).first()
                
                if not existing_alloc:
                    import datetime
                    end_date = project.dismantling_date or (start_date + datetime.timedelta(days=7))
                    alloc = ManagerAllocation(
                        manager_id=manager.id,
                        project_id=project.id,
                        allocation_start_date=start_date,
                        allocation_end_date=end_date
                    )
                    session.add(alloc)
                    allocations_created += 1

        session.commit()
        return {"status": "ok", "managers_created": managers_created, "allocations_created": allocations_created}
    except Exception as e:
        session.rollback()
        return {"status": "error", "message": str(e)}

@app.get("/api/health")
def health_check():
    return {"status": "ok", "message": "Backend is active & DB connected"}
