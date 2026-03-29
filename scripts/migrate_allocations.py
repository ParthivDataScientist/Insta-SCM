import sys
import os
from datetime import timedelta

# Add the project root to the sys.path so we can import app modules
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from sqlmodel import Session, select
from app.db.session import engine
from app.models.manager import Manager
from app.models.manager_allocation import ManagerAllocation
from app.models.dashboard_project import DashboardProject

def run_migration():
    with Session(engine) as session:
        print("Starting migration...")
        
        # 1. Ensure SQLModel actually creates the tables if they don't exist
        from sqlmodel import SQLModel
        SQLModel.metadata.create_all(engine)

        projects = session.exec(select(DashboardProject)).all()
        print(f"Found {len(projects)} projects.")

        managers_created = 0
        allocations_created = 0

        for project in projects:
            pm_name = project.project_manager
            if not pm_name:
                pm_name = "Unassigned"

            # Find or create Manager
            manager = session.exec(select(Manager).where(Manager.name == pm_name)).first()
            if not manager:
                manager = Manager(name=pm_name)
                session.add(manager)
                session.commit()
                session.refresh(manager)
                managers_created += 1

            # Only create allocation if we have a valid start date (material_dispatch_date)
            # If we don't have dispatch date, we'll try to use event_start_date or skip.
            start_date = project.material_dispatch_date or project.event_start_date
            
            if start_date:
                # Check if allocation already exists
                existing_alloc = session.exec(
                    select(ManagerAllocation)
                    .where(ManagerAllocation.manager_id == manager.id)
                    .where(ManagerAllocation.project_id == project.id)
                ).first()
                
                if not existing_alloc:
                    end_date = project.dismantling_date
                    if not end_date:
                       # Default to start_date + 7 days
                       end_date = start_date + timedelta(days=7)

                    alloc = ManagerAllocation(
                        manager_id=manager.id,
                        project_id=project.id,
                        allocation_start_date=start_date,
                        allocation_end_date=end_date
                    )
                    session.add(alloc)
                    allocations_created += 1

        session.commit()
        print(f"Migration completed successfully.")
        print(f"Managers created: {managers_created}")
        print(f"Allocations created: {allocations_created}")

if __name__ == '__main__':
    run_migration()
