import logging
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address
from sqlmodel import SQLModel, Session, select, text
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.api.error_handlers import (
    app_error_handler,
    http_exception_handler,
    unhandled_exception_handler,
    validation_exception_handler,
)
from app.api.middleware.request_id import RequestIdMiddleware
from app.core.config import settings
from app.core.errors import AppError
from app.core.logging_config import configure_logging
from app.db.session import engine, get_session
from app.api.v1.api import api_router

configure_logging()
logger = logging.getLogger(__name__)

# Import models so SQLModel can discover them for schema creation
from app.models.dashboard_project import DashboardProject
from app.models.shipment import Shipment  # noqa: F401 — register table metadata
from app.models.user import User
from app.api.v1.endpoints.dashboard_projects_v2 import _apply_design_state

limiter = Limiter(key_func=get_remote_address)

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan: create DB tables on startup and run lightweight schema sync."""
    SQLModel.metadata.create_all(engine)
    _ensure_project_schema_compatibility()
    _backfill_project_canonical_fields()
    logger.info(
        "application_startup_complete",
        extra={"event": "application_startup_complete"},
    )
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

    dashboardproject_columns = {
        "crm_project_id": "ALTER TABLE dashboardproject ADD COLUMN crm_project_id VARCHAR",
        "status": "ALTER TABLE dashboardproject ADD COLUMN status VARCHAR DEFAULT 'pending'",
        "priority": "ALTER TABLE dashboardproject ADD COLUMN priority VARCHAR DEFAULT 'medium'",
        "revision_count": "ALTER TABLE dashboardproject ADD COLUMN revision_count INTEGER DEFAULT 0",
        "current_version": "ALTER TABLE dashboardproject ADD COLUMN current_version VARCHAR",
        "is_active": "ALTER TABLE dashboardproject ADD COLUMN is_active BOOLEAN DEFAULT TRUE",
        "booking_date": "ALTER TABLE dashboardproject ADD COLUMN booking_date DATE",
        "revision_history": "ALTER TABLE dashboardproject ADD COLUMN revision_history JSON",
        "client_id": "ALTER TABLE dashboardproject ADD COLUMN client_id INTEGER",
    }

    shipment_columns = {}
    if "shipment" in inspector.get_table_names():
        shipment_columns = {
            column["name"]
            for column in inspector.get_columns("shipment")
        }

    user_columns = {}
    if "user" in inspector.get_table_names():
        user_columns = {
            column["name"]
            for column in inspector.get_columns("user")
        }
    
    user_ddl = {
        "mfa_secret": 'ALTER TABLE "user" ADD COLUMN mfa_secret VARCHAR',
        "mfa_enabled": 'ALTER TABLE "user" ADD COLUMN mfa_enabled BOOLEAN DEFAULT FALSE',
        "failed_login_attempts": 'ALTER TABLE "user" ADD COLUMN failed_login_attempts INTEGER DEFAULT 0',
        "locked_until": 'ALTER TABLE "user" ADD COLUMN locked_until TIMESTAMP',
        "reset_token": 'ALTER TABLE "user" ADD COLUMN reset_token VARCHAR',
        "reset_token_expires": 'ALTER TABLE "user" ADD COLUMN reset_token_expires TIMESTAMP',
    }

    with engine.begin() as connection:
        for column_name, ddl in dashboardproject_columns.items():
            if column_name not in existing_columns:
                connection.execute(text(ddl))
        if "shipment" in inspector.get_table_names() and "project_id" not in shipment_columns:
            connection.execute(text("ALTER TABLE shipment ADD COLUMN project_id INTEGER"))
        
        for col_name, ddl in user_ddl.items():
            if col_name not in user_columns:
                connection.execute(text(ddl))


def _backfill_project_canonical_fields() -> None:
    with Session(engine) as session:
        projects = session.exec(select(DashboardProject)).all()
        changed = False
        for project in projects:
            before = (
                project.status,
                project.priority,
                project.revision_count,
                project.current_version,
                project.is_active,
                project.stage,
                project.revision_history,
            )
            _apply_design_state(project, {})
            after = (
                project.status,
                project.priority,
                project.revision_count,
                project.current_version,
                project.is_active,
                project.stage,
                project.revision_history,
            )
            if before != after:
                session.add(project)
                changed = True

        if changed:
            session.commit()


app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    lifespan=lifespan,
)

app.add_exception_handler(AppError, app_error_handler)
app.add_exception_handler(StarletteHTTPException, http_exception_handler)
app.add_exception_handler(RequestValidationError, validation_exception_handler)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_exception_handler(Exception, unhandled_exception_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(RequestIdMiddleware)

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
        logger.warning(
            "admin_reseed_wipe_started",
            extra={"event": "admin_reseed_wipe_started"},
        )
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
                    if pd.isna(dt):
                        return None
                    return dt.date()
                except Exception:
                    return None

            def safe_str(val):
                if val is None or (isinstance(val, float) and math.isnan(val)):
                    return None
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
                _apply_design_state(p, {})
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
