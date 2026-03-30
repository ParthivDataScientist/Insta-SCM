from sqlmodel import Session, create_engine, select, text
from app.models.user import User
from app.models.dashboard_project import DashboardProject
from app.core.auth import get_password_hash
from app.core.config import settings

engine = create_engine(settings.DATABASE_URL)

def setup_db():
    print(f"Connecting to {settings.DATABASE_URL}...")
    with Session(engine) as session:
        # 1. Check for user table and create a default user
        try:
            admin = session.exec(select(User).where(User.email == "admin@insta.com")).first()
            if not admin:
                print("Creating default admin user...")
                admin = User(
                    email="admin@insta.com",
                    full_name="Admin User",
                    hashed_password=get_password_hash("admin123"),
                    role="ADMIN"
                )
                session.add(admin)
                session.commit()
                print("Admin user created: admin@insta.com / admin123")
            else:
                print("Admin user already exists.")
        except Exception as e:
            print(f"Error checking user: {e}")

        # 2. Check for missing columns in dashboardproject
        try:
            print("Checking dashboardproject scheme...")
            # SQLite specific column check
            res = session.execute(text("PRAGMA table_info(dashboardproject)")).all()
            cols = [r[1] for r in res]
            print(f"Found columns: {cols}")
            
            if 'client_id' not in cols:
                print("Adding client_id column...")
                session.execute(text("ALTER TABLE dashboardproject ADD COLUMN client_id INTEGER REFERENCES client(id)"))
                session.commit()
                print("Added client_id.")
            
            # Check for 'client' vs 'client_id'
            # If the model has client_id but the Excel import uses 'client', maybe we need both or a mapping.
            # But the error was specifically 'no such column: dashboardproject.client_id' when selecting.

        except Exception as e:
            print(f"Error fixing table: {e}")

if __name__ == "__main__":
    setup_db()
