from contextlib import asynccontextmanager

from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import SQLModel, Session, text, select, func
from sqlalchemy import inspect

from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from app.core.config import settings
from app.db.session import engine, get_session
from app.api.v1.api import api_router

# Import models so SQLModel can discover them for schema creation
from app.models.dashboard_project import DashboardProject
from app.models.user import User
from app.models.shipment import Shipment

limiter = Limiter(key_func=get_remote_address)

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan: create DB tables on startup."""
    SQLModel.metadata.create_all(engine)
    _ensure_project_schema_compatibility()
    yield


def _ensure_project_schema_compatibility() -> None:
    """Add newly introduced nullable columns when running against an older DB."""
    inspector = inspect(engine)
    if "dashboardproject" not in inspector.get_table_names():
        return

    existing_columns = {
        column["name"]
        for column in inspector.get_columns("dashboardproject")
    }

    if "crm_project_id" not in existing_columns:
        with engine.begin() as connection:
            connection.execute(
                text("ALTER TABLE dashboardproject ADD COLUMN crm_project_id VARCHAR")
            )


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
    """Secret admin endpoint to wipe and re-seed the project database with the new 2-table schema."""
    try:
        import os
        import pandas as pd
        import math
        from sqlmodel import text
        from datetime import timedelta

        # 1. Wipe current projects
        print("[admin-reseed] Wiping dashboardproject table...")
        session.execute(text("DELETE FROM dashboardproject;"))
        # DO NOT wipe users as it may contain auth accounts. Let's только create/lookup managers.
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

            managers_map = {} # Cache manager lookups by name
            for _, row in df.iterrows():
                pm_name = safe_str(row.get('Project Manager')) or "Unassigned"
                
                # Check for existing manager user record
                if pm_name not in managers_map:
                    manager_user = session.exec(select(User).where(User.full_name == pm_name)).first()
                    if not manager_user:
                        # Automatically create a manager account for the data import
                        manager_user = User(
                            full_name=pm_name,
                            email=f"{pm_name.lower().replace(' ', '.')}@example.com",
                            hashed_password="TEMP_PLACEHOLDER", # Should be updated later via auth system
                            role="PROJECT_MANAGER"
                        )
                        session.add(manager_user)
                        session.commit()
                        session.refresh(manager_user)
                    managers_map[pm_name] = manager_user

                m = managers_map[pm_name]

                # Map new fields from Excel
                dispatch_date = parse_date(row.get('Material Dispatch Date'))
                dismantle_date = parse_date(row.get('Dismantling Date'))
                
                # Default allocation for Gantt chart view if dates are missing
                alloc_start = dispatch_date or parse_date(row.get('Event Start Date'))
                if alloc_start and not dismantle_date:
                    alloc_end = alloc_start + timedelta(days=7)
                else:
                    alloc_end = dismantle_date

                p = DashboardProject(
                    project_name=safe_str(row.get('Project Name', 'Unknown')),
                    client=safe_str(row.get('Client')), # Assuming Column in Excel
                    city=safe_str(row.get('City')),     # Assuming Column in Excel
                    event_name=safe_str(row.get('Event Name')),
                    venue=safe_str(row.get('Venue')),
                    area=safe_str(row.get('Area (Sqm)')),
                    event_start_date=parse_date(row.get('Event Start Date')),
                    event_end_date=parse_date(row.get('Event End Date')),
                    dispatch_date=dispatch_date,
                    installation_start_date=parse_date(row.get('Installation Start Date')),
                    installation_end_date=parse_date(row.get('Installation End Date')),
                    dismantling_date=dismantle_date,
                    team_type=safe_str(row.get('Team Type')),
                    stage=safe_str(row.get('Stage')) or 'Open',
                    board_stage='TBC', # Default Kanban stage
                    branch=safe_str(row.get('Branch')),
                    manager_id=m.id,
                    allocation_start_date=alloc_start,
                    allocation_end_date=alloc_end
                )
                session.add(p)
                
            session.commit()
            return {"status": "success", "message": f"Wiped and re-seeded {len(df)} projects successfully using unified schema."}
        else:
            return {"status": "error", "message": f"Excel file not found at {excel_path}."}
    except Exception as e:
        session.rollback()
        return {"status": "error", "message": str(e)}


@app.get("/")
def root():
    return {"message": "Insta-Track API is running", "docs": "/docs"}


@app.get("/api/health")
def health_check():
    return {"status": "ok", "message": "Backend is active & DB connected"}
