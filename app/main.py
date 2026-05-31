import logging
from pathlib import Path
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address
from sqlmodel import SQLModel, Session, select, text
from fastapi.staticfiles import StaticFiles
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
from app.models.dashboard_project import DashboardProject, Client, ProjectAuditLog, ProjectLink, ProjectResource
from app.models.shipment import Shipment  # noqa: F401 — register table metadata
from app.models.user import User
from app.api.v1.endpoints.dashboard_projects_v2 import _apply_design_state

limiter = Limiter(key_func=get_remote_address)

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan: create DB tables on startup and run lightweight schema sync."""
    Path(settings.STORAGE_DIR).mkdir(parents=True, exist_ok=True)
    Path(settings.STORAGE_DIR, settings.DHL_LABELS_SUBDIR).mkdir(parents=True, exist_ok=True)
    
    try:
        logger.info("db_init_started", extra={"event": "db_init_started"})
        SQLModel.metadata.create_all(engine)
        
        if settings.AUTO_SYNC_SCHEMA:
            changes = _ensure_project_schema_compatibility()
            if changes:
                logger.info("schema_auto_sync_applied", extra={"event": "schema_auto_sync_applied", "changes": changes})
            
            _backfill_project_canonical_fields()
            
        _ensure_default_admin()
            
        logger.info(
            "application_startup_complete",
            extra={"event": "application_startup_complete"},
        )
    except Exception as e:
        logger.error(
            "application_startup_db_error",
            extra={"event": "application_startup_db_error", "error": str(e)},
            exc_info=True
        )
        # We don't crash the app here so the health check can still return 500/errors 
        # instead of the whole function being unreachable on Vercel.
        
    yield


def _ensure_project_schema_compatibility() -> list[str]:
    """Add newly introduced nullable columns when running against an older DB. Returns list of applied changes."""
    applied_changes = []
    inspector = inspect(engine)
    if "dashboardproject" not in inspector.get_table_names():
        return []

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
    if "users" in inspector.get_table_names():
        user_columns = {
            column["name"]
            for column in inspector.get_columns("users")
        }
    
    user_ddl = {
        "mfa_secret": 'ALTER TABLE "users" ADD COLUMN mfa_secret VARCHAR',
        "mfa_enabled": 'ALTER TABLE "users" ADD COLUMN mfa_enabled BOOLEAN DEFAULT FALSE',
        "failed_login_attempts": 'ALTER TABLE "users" ADD COLUMN failed_login_attempts INTEGER DEFAULT 0',
        "locked_until": 'ALTER TABLE "users" ADD COLUMN locked_until TIMESTAMP',
        "reset_token": 'ALTER TABLE "users" ADD COLUMN reset_token VARCHAR',
        "reset_token_expires": 'ALTER TABLE "users" ADD COLUMN reset_token_expires TIMESTAMP',
    }

    with engine.begin() as connection:
        for column_name, ddl in dashboardproject_columns.items():
            if column_name not in existing_columns:
                connection.execute(text(ddl))
                applied_changes.append(f"dashboardproject.{column_name}")
        if "shipment" in inspector.get_table_names():
            shipment_ddl = {
                "country": "ALTER TABLE shipment ADD COLUMN country VARCHAR",
                "master_tracking_number": "ALTER TABLE shipment ADD COLUMN master_tracking_number VARCHAR",
                "is_master": "ALTER TABLE shipment ADD COLUMN is_master BOOLEAN DEFAULT FALSE",
                "child_tracking_numbers": "ALTER TABLE shipment ADD COLUMN child_tracking_numbers JSON",
                "child_parcels": "ALTER TABLE shipment ADD COLUMN child_parcels JSON",
                "is_archived": "ALTER TABLE shipment ADD COLUMN is_archived BOOLEAN DEFAULT FALSE",
                "cs": "ALTER TABLE shipment ADD COLUMN cs VARCHAR",
                "no_of_box": "ALTER TABLE shipment ADD COLUMN no_of_box VARCHAR",
                "booking_date": "ALTER TABLE shipment ADD COLUMN booking_date VARCHAR",
                "show_city": "ALTER TABLE shipment ADD COLUMN show_city VARCHAR",
                "cs_type": "ALTER TABLE shipment ADD COLUMN cs_type VARCHAR",
                "remarks": "ALTER TABLE shipment ADD COLUMN remarks VARCHAR",
                "last_scan_date": "ALTER TABLE shipment ADD COLUMN last_scan_date VARCHAR",
                "project_id": "ALTER TABLE shipment ADD COLUMN project_id INTEGER",
                "lifecycle_state": "ALTER TABLE shipment ADD COLUMN lifecycle_state VARCHAR",
                "awb": "ALTER TABLE shipment ADD COLUMN awb VARCHAR",
                "label_url": "ALTER TABLE shipment ADD COLUMN label_url VARCHAR",
                "label_path": "ALTER TABLE shipment ADD COLUMN label_path VARCHAR",
                "pickup_id": "ALTER TABLE shipment ADD COLUMN pickup_id VARCHAR",
                "pickup_status": "ALTER TABLE shipment ADD COLUMN pickup_status VARCHAR",
                "quote_amount": "ALTER TABLE shipment ADD COLUMN quote_amount FLOAT",
                "quote_currency": "ALTER TABLE shipment ADD COLUMN quote_currency VARCHAR",
                "quoted_delivery_time": "ALTER TABLE shipment ADD COLUMN quoted_delivery_time VARCHAR",
                "service_type": "ALTER TABLE shipment ADD COLUMN service_type VARCHAR",
                "package_weight_kg": "ALTER TABLE shipment ADD COLUMN package_weight_kg FLOAT",
                "package_length_cm": "ALTER TABLE shipment ADD COLUMN package_length_cm FLOAT",
                "package_width_cm": "ALTER TABLE shipment ADD COLUMN package_width_cm FLOAT",
                "package_height_cm": "ALTER TABLE shipment ADD COLUMN package_height_cm FLOAT",
                "booking_payload": "ALTER TABLE shipment ADD COLUMN booking_payload JSON",
                "title": "ALTER TABLE shipment ADD COLUMN title VARCHAR",
                "estimated_delivery": "ALTER TABLE shipment ADD COLUMN estimated_delivery DATE",
                "origin_city": "ALTER TABLE shipment ADD COLUMN origin_city VARCHAR",
                "destination_city": "ALTER TABLE shipment ADD COLUMN destination_city VARCHAR",
                "manual_lock": "ALTER TABLE shipment ADD COLUMN manual_lock BOOLEAN DEFAULT FALSE",
            }
            for col_name, ddl in shipment_ddl.items():
                if col_name not in shipment_columns:
                    connection.execute(text(ddl))
                    applied_changes.append(f"shipment.{col_name}")
        
        for col_name, ddl in user_ddl.items():
            if col_name not in user_columns:
                connection.execute(text(ddl))
                applied_changes.append(f"users.{col_name}")

    return applied_changes


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


def _ensure_default_admin() -> None:
    """Create default admin user if not present."""
    from app.core.auth import get_password_hash
    from sqlmodel import Session, select
    from app.models.user import User
    try:
        with Session(engine) as session:
            admin = session.exec(select(User).where(User.email == "admin@example.com")).first()
            if not admin:
                admin = User(
                    full_name="Admin",
                    email="admin@example.com",
                    hashed_password=get_password_hash("admin123"),
                    role="ADMIN",
                    is_active=True
                )
                session.add(admin)
                session.commit()
                logger.info("default_admin_created", extra={"event": "default_admin_created"})
            else:
                logger.info("default_admin_already_exists", extra={"event": "default_admin_already_exists"})
    except Exception as e:
        logger.error("ensure_default_admin_failed", extra={"event": "ensure_default_admin_failed", "error": str(e)}, exc_info=True)


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
app.mount("/storage", StaticFiles(directory=settings.STORAGE_DIR, check_dir=False), name="storage")


@app.get("/api/admin/db-init")
def admin_db_init():
    """Manual trigger to create database tables. Useful for fresh deployments or after cleaning DB."""
    try:
        SQLModel.metadata.create_all(engine)
        inspector = inspect(engine)
        tables = inspector.get_table_names()
        return {
            "status": "success", 
            "message": "Database schema synchronization complete.",
            "tables_found": tables
        }
    except Exception as e:
        logger.error(f"Manual DB init failed: {str(e)}")
        return {"status": "error", "message": str(e)}


@app.get("/api/admin/reseed")
def admin_reseed(session: Session = Depends(get_session)):
    """Secret admin endpoint to wipe and re-seed the project database with the new 2-table schema."""
    try:
        # Ensure tables exist before trying to delete
        SQLModel.metadata.create_all(engine)
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
    try:
        # Test DB connection
        with Session(engine) as session:
            session.execute(text("SELECT 1"))
        return {"status": "ok", "message": "Backend is active & DB connected", "database": "connected"}
    except Exception as e:
        return {"status": "error", "message": f"Backend active but DB unreachable: {str(e)}", "database": "error"}
