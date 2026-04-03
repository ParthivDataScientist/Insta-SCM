from datetime import date as py_date, timedelta
from typing import Optional

from sqlmodel import Session, select

from app.models.dashboard_project import DashboardProject

EXECUTION_STAGE_ALIASES = {"win", "won", "confirmed"}


def _get_project_window(project: DashboardProject) -> tuple[Optional[py_date], Optional[py_date]]:
    start = (
        project.allocation_start_date
        or project.dispatch_date
        or project.event_start_date
    )
    end = (
        project.allocation_end_date
        or project.dismantling_date
        or project.event_end_date
    )

    if start and end and end < start:
        end = start

    return start, end


def _ranges_overlap(
    left_start: py_date,
    left_end: Optional[py_date],
    right_start: py_date,
    right_end: Optional[py_date],
) -> bool:
    left_end_effective = left_end or py_date.max
    right_end_effective = right_end or py_date.max
    return left_start <= right_end_effective and right_start <= left_end_effective


def _build_available_windows(
    projects: list[DashboardProject],
    anchor_start: py_date,
) -> list[dict]:
    busy_ranges: list[tuple[py_date, Optional[py_date]]] = []
    for project in projects:
        start, end = _get_project_window(project)
        if start:
            busy_ranges.append((start, end))

    busy_ranges.sort(key=lambda value: value[0])

    merged_ranges: list[list[Optional[py_date]]] = []
    for start, end in busy_ranges:
        if not merged_ranges:
            merged_ranges.append([start, end])
            continue

        prev_end = merged_ranges[-1][1]

        if prev_end is None or start <= prev_end + timedelta(days=1):
            if prev_end is None or end is None:
                merged_ranges[-1][1] = None
            else:
                merged_ranges[-1][1] = max(prev_end, end)
            continue

        merged_ranges.append([start, end])

    available_windows: list[dict] = []
    cursor = anchor_start

    for busy_start, busy_end in merged_ranges:
        if busy_start > cursor:
            window_end = busy_start - timedelta(days=1)
            available_windows.append(
                {
                    "start_date": cursor,
                    "end_date": window_end,
                    "days": (window_end - cursor).days + 1,
                }
            )

        if busy_end is None:
            return available_windows

        cursor = max(cursor, busy_end + timedelta(days=1))

    available_windows.append(
        {
            "start_date": cursor,
            "end_date": None,
            "days": None,
        }
    )
    return available_windows


def is_manager_available(
    session: Session,
    new_start: py_date,
    new_end: Optional[py_date],
    manager_id: Optional[int] = None,
    exclude_project_id: Optional[int] = None,
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
        dict: {
            "available": bool,
            "conflicts": List[dict],
            "available_windows": List[dict],
        }
    """
    if not new_start:
        return {"available": True, "conflicts": [], "available_windows": []}

    stmt = select(DashboardProject).where(
        (DashboardProject.allocation_start_date.is_not(None))
        | (DashboardProject.dispatch_date.is_not(None))
        | (DashboardProject.event_start_date.is_not(None))
    )

    if manager_id:
        stmt = stmt.where(DashboardProject.manager_id == manager_id)

    if exclude_project_id:
        stmt = stmt.where(DashboardProject.id != exclude_project_id)

    projects = [
        project
        for project in session.exec(stmt).all()
        if (project.stage or "").strip().lower() in EXECUTION_STAGE_ALIASES
    ]
    conflicts = []
    for project in projects:
        project_start, project_end = _get_project_window(project)
        if not project_start:
            continue

        if _ranges_overlap(project_start, project_end, new_start, new_end):
            conflicts.append(
                {
                    "id": project.id,
                    "crm_project_id": project.crm_project_id,
                    "project_name": project.project_name,
                    "manager_id": project.manager_id,
                    "dispatch_date": project.dispatch_date,
                    "dismantling_date": project.dismantling_date,
                    "event_start_date": project.event_start_date,
                    "event_end_date": project.event_end_date,
                }
            )

    return {
        "available": len(conflicts) == 0,
        "conflicts": conflicts,
        "available_windows": _build_available_windows(projects, new_start),
    }
