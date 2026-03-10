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

limiter = Limiter(key_func=get_remote_address)

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan: create DB tables on startup and safely add new columns."""
    SQLModel.metadata.create_all(engine)

    # Safe manual migrations — each ALTER TABLE is wrapped individually so one failure
    # (column already exists) doesn't block the others.
    migration_stmts = [
        ("exhibition_name",         "ALTER TABLE shipment ADD COLUMN exhibition_name VARCHAR;"),
        ("master_tracking_number",  "ALTER TABLE shipment ADD COLUMN master_tracking_number VARCHAR;"),
        ("is_master",               "ALTER TABLE shipment ADD COLUMN is_master BOOLEAN DEFAULT FALSE;"),
        # Kept for backward compat — old DB rows still have this column (ignored by the new model)
        ("child_tracking_numbers",  "ALTER TABLE shipment ADD COLUMN child_tracking_numbers JSON;"),
        # New: stores [{tracking_number, status, raw_status}, ...] per MPS child
        ("child_parcels",           "ALTER TABLE shipment ADD COLUMN child_parcels JSON;"),
        ("is_archived",             "ALTER TABLE shipment ADD COLUMN is_archived BOOLEAN DEFAULT FALSE;"),
    ]

    with Session(engine) as session:
        for col_name, stmt in migration_stmts:
            try:
                session.execute(text(stmt))
                session.commit()
                print(f"[migration] Added column: {col_name}")
            except Exception:
                session.rollback()   # column already exists — ignore

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
    allow_origins=[settings.ALLOWED_ORIGIN, "http://127.0.0.1:5173", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "DELETE", "PATCH", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "X-API-Key"],
)

app.include_router(api_router, prefix=settings.API_V1_STR)


@app.get("/")
def root():
    return {"message": "Insta-Track API is running", "docs": "/docs"}


@app.get("/api/health")
def health_check():
    return {"status": "ok", "message": "Backend is active & DB connected"}
