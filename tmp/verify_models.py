from sqlmodel import SQLModel, create_engine, Session
from app.models import User, DashboardProject
from datetime import date
import os

# Final verification with ALL new columns (fixed with date objects)
sqlite_url = "sqlite:///tmp_verify_final_full_fixed.db"
engine = create_engine(sqlite_url)

def verify():
    print("Creating tables with all columns...")
    SQLModel.metadata.create_all(engine)
    print("Tables created successfully.")

    with Session(engine) as session:
        print("Testing Full Project Lifecycle Model...")
        
        # Create a User (Manager)
        manager = User(
            full_name="Alice Architect",
            email="alice@google.com",
            hashed_password="hashed_secret"
        )
        session.add(manager)
        session.commit()
        session.refresh(manager)

        # Create a Project with the full suite of dates and stages
        project = DashboardProject(
            project_name="Expo 2026",
            manager_id=manager.id,
            stage="Confirmed",
            board_stage="Pre-build",
            venue="London ExCel",
            area="Hall A",
            branch="London",
            event_start_date=date(2026, 5, 10),
            event_end_date=date(2026, 5, 15),
            dispatch_date=date(2026, 5, 5),
            installation_start_date=date(2026, 5, 8),
            installation_end_date=date(2026, 5, 9),
            dismantling_date=date(2026, 5, 16),
            allocation_start_date=date(2026, 5, 5),
            allocation_end_date=date(2026, 5, 16)
        )
        session.add(project)
        session.commit()
        session.refresh(project)
        
        print(f"Project '{project.project_name}' successfully created.")
        print(f"Project Stage: {project.stage}")
        print(f"Board Stage: {project.board_stage}")
        print(f"Gantt Range: {project.allocation_start_date} to {project.allocation_end_date}")

    print("Final verification complete!")

if __name__ == "__main__":
    try:
        verify()
    finally:
        engine.dispose()
        if os.path.exists("tmp_verify_final_full_fixed.db"):
            os.remove("tmp_verify_final_full_fixed.db")
