from sqlmodel import create_engine, Session
from app.core.config import settings

# connect_args={"check_same_thread": False} is needed only for SQLite
connect_args = {"check_same_thread": False} if "sqlite" in settings.DATABASE_URL else {}

engine = create_engine(
    settings.DATABASE_URL,
    echo=settings.SQLALCHEMY_ECHO,
    connect_args=connect_args,
)

def get_session():
    with Session(engine) as session:
        yield session 