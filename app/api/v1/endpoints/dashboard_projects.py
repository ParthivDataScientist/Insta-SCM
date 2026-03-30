import json
from datetime import date as py_date
from datetime import datetime, timezone
from typing import Any, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select, func, text

from app.db.session import engine
from app.models.dashboard_project import DashboardProject
from app.models.manager import Manager
from app.models.manager_allocation import ManagerAllocation
from app.models.user import User
from app.schemas.dashboard_project import DashboardProjectCreate, DashboardProjectRead, DashboardProjectUpdate
from app.services.availability import is_manager_available

router = APIRouter()


def _coerce_list(value: Any) -> list:
    if value is None:
        return []
    if isinstance(value, list):
        return value
    if isinstance(value, (tuple, set)):
        return list(value)
    if isinstance(value, str):
        raw = value.strip()
        if not raw:
            return []
        try:
            parsed = json.loads(raw)
        except Exception:
            return [value]
        return parsed if isinstance(parsed, list) else [parsed]
    return [value]


def _serialize_project(row: Any) -> DashboardProjectRead:
    # Supports both ORM objects and SQL mappings.
    get = row.get if hasattr(row, "get") else lambda key, default=None: getattr(row, key, default)

    return DashboardProjectRead(
        id=get("id"),
        project_name=get("project_name") or "Unknown",
        date=get("date"),
        client=get("client"),
        city=get("city"),
        event_name=get("event_name"),
        venue=get("venue"),
        area=get("area"),
        event_start_date=get("event_start_date"),
        event_end_date=get("event_end_date"),
        material_dispatch_date=get("material_dispatch_date"),
        installation_start_date=get("installation_start_date"),
        installation_end_date=get("installation_end_date"),
        dismantling_date=get("dismantling_date"),
        project_manager=get("project_manager"),
        team_type=get("team_type"),
        stage=get("stage"),
        branch=get("branch"),
        board_stage=get("board_stage") or "TBC",
        comments=_coerce_list(get("comments")),
        materials=_coerce_list(get("materials")),
        photos=_coerce_list(get("photos")),
        qc_steps=_coerce_list(get("qc_steps")),
        created_at=get("created_at") or datetime.now(timezone.utc),
        updated_at=get("updated_at") or datetime.now(timezone.utc),
    )


def resolve_manager_entities(session: Session, pm_name: Optional[str]):
    normalized_name = (pm_name or "Unassigned").strip() or "Unassigned"

    manager = session.exec(select(Manager).where(Manager.name == normalized_name)).first()
    if not manager:
        manager = Manager(name=normalized_name)
        session.add(manager)
        session.commit()
        session.refresh(manager)

    manager_user = session.exec(
        select(User).where(
            (User.full_name == normalized_name) | (User.email == normalized_name)
        )
    ).first()
    return manager, manager_user


def sync_project_manager_and_allocation(session: Session, project: DashboardProject) -> None:
    manager = None
    manager_user = None

    if project.project_manager is not None and project.project_manager.strip():
        manager, manager_user = resolve_manager_entities(session, project.project_manager)
        project.manager_id = manager.id
    else:
        manager, manager_user = resolve_manager_entities(session, None)
        project.manager_id = manager.id

    start_date = project.material_dispatch_date or project.event_start_date
    existing_alloc = session.exec(
        select(ManagerAllocation).where(ManagerAllocation.project_id == project.id)
    ).first()

    if not start_date:
        if existing_alloc:
            session.delete(existing_alloc)
        session.add(project)
        session.commit()
        return

    import datetime

    end_date = project.dismantling_date or (start_date + datetime.timedelta(days=7))

    if existing_alloc:
        existing_alloc.manager_id = manager.id
        existing_alloc.manager_user_id = manager_user.id if manager_user else None
        existing_alloc.allocation_start_date = start_date
        existing_alloc.allocation_end_date = end_date
        session.add(existing_alloc)
    else:
        session.add(
            ManagerAllocation(
                manager_id=manager.id,
                manager_user_id=manager_user.id if manager_user else None,
                project_id=project.id,
                allocation_start_date=start_date,
                allocation_end_date=end_date,
            )
        )
    session.add(project)
    session.commit()


def get_session():
    with Session(engine) as session:
        yield session


@router.get("/stats")
def get_project_stats(session: Session = Depends(get_session)):
    projects = session.exec(select(DashboardProject)).all()

    total = len(projects)
    open_briefs = sum(1 for p in projects if not p.stage or p.stage.lower() != "confirmed")
    won_projects = sum(1 for p in projects if p.stage and p.stage.lower() == "confirmed")

    # Unique branch count
    branches = {p.branch for p in projects if p.branch}
    # Unique PM count
    pms = {p.project_manager for p in projects if p.project_manager}

    return {
        "total": total,
        "open_briefs": open_briefs,
        "won_projects": won_projects,
        "branches_count": len(branches),
        "pm_count": len(pms)
    }


@router.get("/", response_model=List[DashboardProjectRead])
def get_projects(
    session: Session = Depends(get_session),
    stage: Optional[str] = None
):
    try:
        query = select(DashboardProject)
        if stage:
            query = query.where(DashboardProject.stage == stage)
        projects = session.exec(query).all()
        return [_serialize_project(project) for project in projects]
    except Exception:
        # Production-safe fallback for partially migrated schemas:
        # return records from raw table shape, filling missing fields.
        rows = session.execute(text("SELECT * FROM dashboardproject")).mappings().all()
        response = []
        for row in rows:
            if stage and row.get("stage") != stage:
                continue
            response.append(_serialize_project(row))
        return response


@router.post("/", response_model=DashboardProjectRead)
def create_project(project_in: DashboardProjectCreate, session: Session = Depends(get_session)):
    project = DashboardProject.model_validate(project_in)

    if project.project_manager is not None and project.project_manager.strip():
        manager, _ = resolve_manager_entities(session, project.project_manager)
        project.manager_id = manager.id

    session.add(project)
    session.commit()
    session.refresh(project)

    # Strictly synchronize ManagerAllocation to project dates.
    sync_project_manager_and_allocation(session, project)
    session.refresh(project)
    return project


@router.put("/{project_id}", response_model=DashboardProjectRead)
def update_project(project_id: int, project_in: DashboardProjectUpdate, session: Session = Depends(get_session)):
    project = session.get(DashboardProject, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    update_data = project_in.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(project, key, value)

    if project.project_manager is not None and project.project_manager.strip():
        manager, _ = resolve_manager_entities(session, project.project_manager)
        project.manager_id = manager.id
    elif "project_manager" in update_data:
        project.manager_id = None

    # Force updated_at for SQLite triggers
    project.updated_at = func.now()

    session.add(project)
    session.commit()
    session.refresh(project)

    # Strictly synchronize ManagerAllocation to project dates.
    sync_project_manager_and_allocation(session, project)
    session.refresh(project)
    return project


@router.delete("/{project_id}")
def delete_project(project_id: int, session: Session = Depends(get_session)):
    project = session.get(DashboardProject, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    session.delete(project)
    session.commit()
    return {"message": "Project deleted successfully"}


@router.get("/manager/{manager_name}", response_model=List[DashboardProjectRead])
def get_manager_projects(manager_name: str, session: Session = Depends(get_session)):
    """
    Fetch all projects assigned to a specific manager.
    """
    query = select(DashboardProject).where(DashboardProject.project_manager == manager_name)
    projects = session.exec(query).all()
    return projects


@router.get("/availability-check")
def check_availability(
    start_date: py_date,
    end_date: Optional[py_date] = None,
    manager_name: Optional[str] = None,
    session: Session = Depends(get_session)
):
    """
    Check availability for a manager or all managers in a date range.
    """
    if manager_name:
        return {
            manager_name: is_manager_available(
                session=session,
                new_start=start_date,
                new_end=end_date,
                manager_name=manager_name,
            )
        }

    manager_names = session.exec(
        select(DashboardProject.project_manager)
        .where(DashboardProject.project_manager.is_not(None))
        .distinct()
    ).all()

    results = {}
    for pm in manager_names:
        if not pm:
            continue
        results[pm] = is_manager_available(
            session=session,
            new_start=start_date,
            new_end=end_date,
            manager_name=pm,
        )

    return results


@router.get("/timeline")
def get_timeline_data(session: Session = Depends(get_session)):
    """
    Build timeline data exclusively from ManagerAllocation records.
    """
    try:
        from collections import defaultdict

        manager_groups = defaultdict(lambda: {"manager": None, "allocations": []})

        allocations = session.exec(select(ManagerAllocation)).all()
        for alloc in allocations:
            project = alloc.project or session.get(DashboardProject, alloc.project_id)
            if not project:
                continue

            manager_name = (
                (alloc.manager_user.full_name if alloc.manager_user else None)
                or (alloc.manager.name if alloc.manager else None)
                or project.project_manager
                or "Unassigned"
            )

            if manager_groups[manager_name]["manager"] is None:
                manager_groups[manager_name]["manager"] = {
                    "id": alloc.manager.id if alloc.manager else None,
                    "name": manager_name
                }

            manager_groups[manager_name]["allocations"].append({
                "id": alloc.id,
                "project_id": alloc.project_id,
                "manager_id": alloc.manager_id,
                "manager_user_id": alloc.manager_user_id,
                "allocation_start_date": alloc.allocation_start_date,
                "allocation_end_date": alloc.allocation_end_date,
                "project": project.model_dump()
            })

        result = list(manager_groups.values())
        return sorted(result, key=lambda x: str((x["manager"] or {}).get("name", "")))
    except Exception as e:
        print(f"Timeline generation error: {e}")
        return []
