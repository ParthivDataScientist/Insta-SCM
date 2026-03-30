from datetime import date as py_date
from typing import Optional

from sqlmodel import Session, select

from app.models.dashboard_project import DashboardProject


def is_manager_available(
    session: Session,
    new_start: py_date,
    new_end: Optional[py_date],
    manager_id: Optional[int] = None,
) -> dict:
    """
    Checks manager availability for a given date range directly at the database layer.
    Following enterprise-ready standards for resource allocation.

    Args:
        session: Database session.
        new_start: Start date of the incoming assignment.
        new_end: End date of the incoming assignment. If None, treated as open-ended.
        manager_id: Optional manager ID filter.

    Returns:
        dict: { "available": bool, "conflicts": List[dict] }
    """
    if not new_start:
        return {"available": True, "conflicts": []}

    # Query projects where the manager is assigned and has a dispatch date
    stmt = select(DashboardProject).where(DashboardProject.dispatch_date.is_not(None))

    if manager_id:
        stmt = stmt.where(DashboardProject.manager_id == manager_id)

    # Overlap conditions:
    # 1. Existing project starts before or on the new end date (if provided)
    if new_end is not None:
        stmt = stmt.where(DashboardProject.dispatch_date <= new_end)

    # 2. Existing project ends on or after the new start date
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
                "manager_id": project.manager_id,
                "dispatch_date": project.dispatch_date,
                "dismantling_date": project.dismantling_date,
            }
            for project in conflicts
        ],
    }
