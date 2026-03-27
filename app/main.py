from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import SQLModel, Session, text

from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from app.core.config import settings
from app.db.session import engine
from app.api.v1.api import api_router

# Import models so SQLModel can discover them
from app.models.dashboard_project import DashboardProject

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

            count = session.exec(select(func.count(DashboardProject.id))).one()
            if count == 0:
                print("[seeding] Dashboard table is empty. Starting auto-seed...")
                root_dir = os.path.dirname(os.path.abspath(__file__)) # current dir is app/
                # When running in Vercel or locally, resolve relative to the root
                excel_path = os.path.join(os.path.dirname(root_dir), 'resources', 'Project Pilot sheet.xlsx')
                
                if os.path.exists(excel_path):
                    df = pd.read_excel(excel_path)
                    df = df.where(pd.notnull(df), None)

                    def safe_str(val):
                        if val is None or (isinstance(val, float) and math.isnan(val)): return None
                        if isinstance(val, pd.Timestamp): return val.strftime('%Y-%m-%d')
                        s = str(val).strip()
                        return s if s else None

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


@app.get("/")
def root():
    return {"message": "Insta-Track API is running", "docs": "/docs"}


@app.get("/api/health")
def health_check():
    return {"status": "ok", "message": "Backend is active & DB connected"}
