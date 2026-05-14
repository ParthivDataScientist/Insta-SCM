import os

from sqlalchemy.pool import NullPool
from sqlmodel import create_engine, Session

from app.core.config import settings

is_sqlite = settings.DATABASE_URL.startswith("sqlite")
is_serverless = bool(os.environ.get("VERCEL"))

connect_args = {"check_same_thread": False} if is_sqlite else {}
engine_kwargs = {
    "echo": settings.SQLALCHEMY_ECHO,
    "connect_args": connect_args,
}

if not is_sqlite:
    engine_kwargs["pool_pre_ping"] = settings.SQLALCHEMY_POOL_PRE_PING
    engine_kwargs["pool_recycle"] = settings.SQLALCHEMY_POOL_RECYCLE_SECONDS

    # Vercel keeps Python globals warm between invocations, but Postgres/Neon
    # may close the SSL socket while idle. Avoid reusing stale DBAPI
    # connections across serverless requests.
    if is_serverless or settings.SQLALCHEMY_DISABLE_POOL:
        engine_kwargs["poolclass"] = NullPool

engine = create_engine(
    settings.DATABASE_URL,
    **engine_kwargs,
)

def get_session():
    with Session(engine) as session:
        yield session 
