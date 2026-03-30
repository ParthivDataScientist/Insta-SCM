from datetime import date as py_date
from typing import Optional

from sqlmodel import Session, select

from app.models.dashboard_project import DashboardProject


def is_manager_available(
    session: Session,
    new_start: py_date,
    new_end: Optional[py_date],
    manager_name: Optional[str] = None,
) -> dict:
    """
    Checks manager availability for a given date range directly at the database layer.

    Args:
        session: Database session.
        new_start: Start date of the incoming assignment.
        new_end: End date of the incoming assignment. If None, treated as open-ended.
        manager_name: Optional manager name filter.

    Returns:
        dict: { "available": bool, "conflicts": List[dict] }
    """
    if not new_start:
        return {"available": True, "conflicts": []}

    stmt = select(DashboardProject).where(DashboardProject.material_dispatch_date.is_not(None))

    if manager_name:
        stmt = stmt.where(DashboardProject.project_manager == manager_name)

    # Overlap conditions:
    # existing_start <= new_end (or always true when new_end is open-ended)
    # AND existing_end/open >= new_start
    if new_end is not None:
        stmt = stmt.where(DashboardProject.material_dispatch_date <= new_end)

    stmt = stmt.where(
        (DashboardProject.dismantling_date.is_(None))
        | (DashboardProject.dismantling_date >= new_start)
    )

    conflicts = session.exec(stmt).all()

    return {
        "available": len(conflicts) == 0,
        "conflicts": [
            {
                "id": project.id,
                "project_name": project.project_name,
                "project_manager": project.project_manager,
                "material_dispatch_date": project.material_dispatch_date,
                "dismantling_date": project.dismantling_date,
            }
            for project in conflicts
        ],
    }
