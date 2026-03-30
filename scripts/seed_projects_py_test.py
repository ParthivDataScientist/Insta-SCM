import os
import sys
from datetime import date, timedelta
from sqlmodel import Session, select, create_all

# Add project root to sys.path
sys.path.append(os.getcwd())

from app.db.session import engine
from app.models.dashboard_project import DashboardProject, Client
from app.models.user import User

def seed():
    with Session(engine) as session:
        # 1. Ensure a base User exists
        pm = session.exec(select(User).where(User.role == "PROJECT_MANAGER")).first()
        if not pm:
            pm = User(
                full_name="Rajesh Sharma",
                email="rajesh@insta.com",
                role="PROJECT_MANAGER",
                hashed_password="hashed"
            )
            session.add(pm)
            session.commit()
            session.refresh(pm)
        
        # 2. Ensure a base Client exists
        client = session.exec(select(Client)).first()
        if not client:
            client = Client(name="Reliance Industries", industry="Conglomerate")
            session.add(client)
            session.commit()
            session.refresh(client)
        
        # 3. Create Diverse Projects
        projects_to_seed = [
            DashboardProject(
                project_name="INSTA-240330-0001",
                event_name="Jio World Plaza Expo",
                client_id=client.id,
                manager_id=pm.id,
                city="Mumbai",
                venue="BKC",
                stage="Confirmed",
                board_stage="Live",
                event_start_date=date.today(),
                event_end_date=date.today() + timedelta(days=3),
                dispatch_date=date.today() - timedelta(days=2)
            ),
            DashboardProject(
                project_name="INSTA-240330-0002",
                event_name="Unassigned Tech Summit",
                client_id=client.id,
                manager_id=None, # UNASSIGNED CASE
                city="Delhi",
                venue="Pragati Maidan",
                stage="Open",
                board_stage="TBC",
                event_start_date=date.today() + timedelta(days=10),
                event_end_date=date.today() + timedelta(days=12)
            ),
            DashboardProject(
                project_name="INSTA-240330-0003",
                event_name="Nike Launch Event",
                client_id=None, # NO CLIENT CASE
                manager_id=pm.id,
                city="Bangalore",
                venue="Indiranagar Lounge",
                stage="In Progress",
                board_stage="Upcoming",
                event_start_date=date.today() + timedelta(days=5),
                event_end_date=date.today() + timedelta(days=6)
            ),
            DashboardProject(
                project_name="INSTA-240330-0004",
                event_name="Legacy Project Migration",
                client_id=client.id,
                manager_id=pm.id,
                city="Pune",
                venue="Sheraton",
                stage="Open",
                board_stage="TBC",
                dispatch_date=None, # NULL DATE CASE
                dismantling_date=None
            )
        ]

        for p in projects_to_seed:
            # Check if exists by name to avoid duplicates
            existing = session.exec(select(DashboardProject).where(DashboardProject.project_name == p.project_name)).first()
            if not existing:
                session.add(p)
        
        session.commit()
        print(f"Successfully seeded {len(projects_to_seed)} projects.")

if __name__ == "__main__":
    seed()
