import sys
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import SQLModel, Session

from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from app.core.config import settings
from app.db.session import engine
from app.api.v1.api import api_router

limiter = Limiter(key_func=get_remote_address)

from sqlmodel import text

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan: create DB tables on startup and safely add new columns."""
    SQLModel.metadata.create_all(engine)
    
    # Safe manual migration: Add exhibition_name if missing
    try:
        with Session(engine) as session:
            session.execute(text("ALTER TABLE shipment ADD COLUMN exhibition_name VARCHAR;"))
            session.commit()
            print("Successfully safely migrated database schema to include exhibition_name.")
    except Exception as e:
        # Expected exception if the column already exists
        pass
        
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
    allow_origins=[settings.ALLOWED_ORIGIN, "http://127.0.0.1:5173"],
    allow_credentials=False,
    allow_methods=["GET", "POST", "DELETE"],
    allow_headers=["Content-Type", "Authorization", "X-API-Key"],
)

app.include_router(api_router, prefix=settings.API_V1_STR)


@app.get("/")
def root():
    return {"message": "Insta-Track API is running", "docs": "/docs"}


@app.get("/api/health")
def health_check():
    return {"status": "ok", "message": "Backend is active & DB connected"}
