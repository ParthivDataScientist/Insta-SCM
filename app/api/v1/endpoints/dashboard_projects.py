import json
from datetime import date as py_date
from datetime import datetime, timezone
from typing import Any, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select, func, text
from sqlalchemy.exc import IntegrityError
import logging

from app.db.session import get_session
from app.models.dashboard_project import DashboardProject, ProjectAuditLog, Client
from app.models.user import User
from app.schemas.dashboard_project import DashboardProjectCreate, DashboardProjectRead, DashboardProjectUpdate
from app.services.availability import is_manager_available

router = APIRouter()
logger = logging.getLogger(__name__)

WIN_STAGE_ALIASES = {"win", "won", "confirmed"}
DROP_STAGE_ALIASES = {"drop", "dropped", "lost"}
DESIGN_ITERATION_ALIASES = {"design change", "design-change", "design_change"}
IN_PROCESS_ALIASES = {"open", "in-process", "in process", "in_progress", "in-progress"}

CRM_DESIGN_FEED = [
    {
        "crm_project_id": "CRM-DES-2401",
        "project_name": "Aero India Pavilion",
        "event_name": "Aero India",
        "venue": "Yelahanka Air Force Station",
        "area": "360 Sqm",
        "city": "Bengaluru",
        "branch": "Bangalore",
        "stage": "In-Process",
        "event_start_date": py_date(2026, 4, 12),
        "event_end_date": py_date(2026, 4, 16),
    },
    {
        "crm_project_id": "CRM-DES-2402",
        "project_name": "Dubai Health Expo Booth",
        "event_name": "Arab Health",
        "venue": "Dubai World Trade Centre",
        "area": "180 Sqm",
        "city": "Dubai",
        "branch": "Dubai",
        "stage": "Design Change",
        "event_start_date": py_date(2026, 4, 8),
        "event_end_date": py_date(2026, 4, 11),
    },
    {
        "crm_project_id": "CRM-DES-2403",
        "project_name": "Retail Tech Island Stand",
        "event_name": "NRF APAC",
        "venue": "Marina Bay Sands",
        "area": "220 Sqm",
        "city": "Singapore",
        "branch": "Singapore",
        "stage": "Drop",
        "event_start_date": py_date(2026, 5, 4),
        "event_end_date": py_date(2026, 5, 8),
    },
]


def _sync_postgres_sequence(session: Session, table_name: str, column_name: str = "id") -> None:
    """
    Ensure a PostgreSQL serial/identity sequence is aligned to MAX(id).
    This prevents duplicate key violations when sequence state drifts.
    """
    bind = session.get_bind()
    if bind is None or bind.dialect.name != "postgresql":
        return

    seq_stmt = text("SELECT pg_get_serial_sequence(:table_name, :column_name)")
    sequence_name = session.exec(
        seq_stmt,
        {"table_name": table_name, "column_name": column_name},
    ).one()

    if not sequence_name:
        return

    # Set nextval to max(id) + 1 (or 1 for empty table).
    sync_stmt = text(
        f"SELECT setval('{sequence_name}', COALESCE((SELECT MAX({column_name}) FROM {table_name}), 0) + 1, false)"
    )
    session.exec(sync_stmt)

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


def _normalize_stage(stage: Optional[str]) -> str:
    raw_stage = (stage or "Open").strip()
    stage_key = raw_stage.lower()

    if stage_key in WIN_STAGE_ALIASES:
        return "Win"
    if stage_key in DROP_STAGE_ALIASES:
        return "Drop"
    if stage_key in DESIGN_ITERATION_ALIASES:
        return "Design Change"
    if stage_key in IN_PROCESS_ALIASES:
        return "In-Process"

    return raw_stage or "Open"


def _is_won_project(stage: Optional[str]) -> bool:
    return _normalize_stage(stage) == "Win"


def _is_design_project(stage: Optional[str]) -> bool:
    return not _is_won_project(stage)


def _apply_stage_transition(project: DashboardProject, next_stage: Optional[str]) -> None:
    if next_stage is None:
        return

    project.stage = _normalize_stage(next_stage)

    if project.stage == "Win" and not project.board_stage:
        project.board_stage = "TBC"

def _serialize_project(project: DashboardProject) -> DashboardProjectRead:
    """Enterprise-ready serialization mapping for DashboardProject."""
    return DashboardProjectRead(
        id=project.id,
        crm_project_id=project.crm_project_id,
        project_name=project.project_name or "Unknown",
        city=project.city,
        event_name=project.event_name,
        stage=_normalize_stage(project.stage),
        board_stage=project.board_stage or "TBC",
        venue=project.venue,
        area=project.area,
        branch=project.branch,
        manager_id=project.manager_id,
        project_manager=project.manager.full_name if project.manager else "Unassigned",
        client_id=project.client_id,
        client=project.client_relationship.name if project.client_relationship else "No Client",
        event_start_date=project.event_start_date,
        event_end_date=project.event_end_date,
        dispatch_date=project.dispatch_date,
        installation_start_date=project.installation_start_date,
        installation_end_date=project.installation_end_date,
        dismantling_date=project.dismantling_date,
        allocation_start_date=project.allocation_start_date,
        allocation_end_date=project.allocation_end_date,
        created_at=project.created_at,
        updated_at=project.updated_at,
        comments=_coerce_list(getattr(project, "comments", [])),
        materials=_coerce_list(getattr(project, "materials", [])),
        photos=_coerce_list(getattr(project, "photos", [])),
        qc_steps=_coerce_list(getattr(project, "qc_steps", [])),
    )

@router.get("/stats")
def get_project_stats(session: Session = Depends(get_session)):
    """Calculate execution project statistics."""
    projects = session.exec(select(DashboardProject)).all()
    execution_projects = [p for p in projects if _is_won_project(p.stage)]

    total = len(execution_projects)
    open_briefs = sum(1 for p in projects if _normalize_stage(p.stage) == "In-Process")
    won_projects = len(execution_projects)

    # Unique branch count
    branches = {p.branch for p in execution_projects if p.branch}
    # Unique PM count (from User table)
    pm_count = session.exec(select(func.count(User.id)).where(User.role == "PROJECT_MANAGER")).one()

    return {
        "total": total,
        "open_briefs": open_briefs,
        "won_projects": won_projects,
        "branches_count": len(branches),
        "pm_count": pm_count
    }


@router.get("/designs/stats")
def get_design_stats(session: Session = Depends(get_session)):
    """Return KPI metrics for the pre-sales Design Management page."""
    design_source_projects = session.exec(
        select(DashboardProject).where(DashboardProject.crm_project_id.is_not(None))
    ).all()

    total_brief = sum(
        1
        for project in design_source_projects
        if _normalize_stage(project.stage) != "Drop"
    )
    win_count = sum(1 for project in design_source_projects if _is_won_project(project.stage))
    drop_count = sum(
        1
        for project in design_source_projects
        if _normalize_stage(project.stage) == "Drop"
    )
    design_iterations = sum(
        1
        for project in design_source_projects
        if _normalize_stage(project.stage) == "Design Change"
    )
    decisions = win_count + drop_count
    win_rate = round((win_count / decisions) * 100, 1) if decisions else 0.0
    drop_rate = round((drop_count / decisions) * 100, 1) if decisions else 0.0

    return {
        "total_brief": total_brief,
        "win_count": win_count,
        "drop_count": drop_count,
        "win_rate": win_rate,
        "drop_rate": drop_rate,
        "design_iterations": design_iterations,
    }


@router.get("/crm/designs")
def get_crm_design_feed():
    """Simulate the upstream CRM design API payload."""
    return CRM_DESIGN_FEED


@router.get("/designs", response_model=List[DashboardProjectRead])
def get_design_projects(session: Session = Depends(get_session)):
    """Retrieve pre-sales projects that have not yet transitioned into execution."""
    projects = session.exec(select(DashboardProject)).all()
    design_projects = [
        project
        for project in projects
        if _is_design_project(project.stage)
    ]
    return [_serialize_project(project) for project in design_projects]


@router.post("/crm/designs/sync")
def sync_crm_design_feed(session: Session = Depends(get_session)):
    """Upsert simulated CRM briefs into the shared DashboardProject table."""
    upserted = 0

    for crm_record in CRM_DESIGN_FEED:
        project = session.exec(
            select(DashboardProject).where(
                DashboardProject.crm_project_id == crm_record["crm_project_id"]
            )
        ).first()
        already_won = bool(project and _is_won_project(project.stage))

        if not project:
            project = DashboardProject(
                crm_project_id=crm_record["crm_project_id"],
                project_name=crm_record["project_name"],
                board_stage="TBC",
            )

        for key, value in crm_record.items():
            if key == "stage":
                _apply_stage_transition(project, "Win" if already_won else value)
            else:
                setattr(project, key, value)

        if not project.board_stage:
            project.board_stage = "TBC"

        session.add(project)
        upserted += 1

    session.commit()

    return {
        "message": "CRM design feed synchronized",
        "upserted": upserted,
        "records": CRM_DESIGN_FEED,
    }


@router.post("/designs/{project_id}/win", response_model=DashboardProjectRead)
def convert_design_to_project(project_id: int, session: Session = Depends(get_session)):
    """Promote a design brief into an execution project."""
    project = session.get(DashboardProject, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    _apply_stage_transition(project, "Win")
    project.board_stage = project.board_stage or "TBC"
    session.add(project)
    session.commit()
    session.refresh(project)
    return _serialize_project(project)

@router.get("/", response_model=List[DashboardProjectRead])
def get_projects(
    session: Session = Depends(get_session),
    stage: Optional[str] = None,
    scope: str = Query(default="execution")
):
    """Retrieve projects, defaulting to execution projects only."""
    projects = session.exec(select(DashboardProject)).all()

    if scope == "execution":
        projects = [project for project in projects if _is_won_project(project.stage)]
    elif scope == "design":
        projects = [project for project in projects if _is_design_project(project.stage)]
    elif scope != "all":
        raise HTTPException(status_code=400, detail="scope must be one of: execution, design, all")

    if stage:
        normalized_stage = _normalize_stage(stage)
        projects = [
            project
            for project in projects
            if _normalize_stage(project.stage) == normalized_stage
        ]

    return [_serialize_project(project) for project in projects]

@router.post("/", response_model=DashboardProjectRead)
def create_project(project_in: DashboardProjectCreate, session: Session = Depends(get_session)):
    """Create a new project in the unified schema."""
    project = DashboardProject.model_validate(project_in)
    _apply_stage_transition(project, project.stage)
    project.board_stage = project.board_stage or "TBC"
    session.add(project)
    try:
        session.commit()
    except IntegrityError as exc:
        session.rollback()
        logger.warning("Project create failed integrity check: %s", exc)
        raise HTTPException(
            status_code=400,
            detail="Invalid project create payload (e.g., duplicate CRM Project ID or unknown references).",
        ) from exc
    session.refresh(project)
    return _serialize_project(project)

@router.put("/{project_id}", response_model=DashboardProjectRead)
def update_project(project_id: int, project_in: DashboardProjectUpdate, session: Session = Depends(get_session)):
    """Update an existing project's details with automatic audit logging."""
    project = session.get(DashboardProject, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Fields to monitor for Audit Logging
    audit_fields = [
        "stage",
        "board_stage",
        "dispatch_date",
        "dismantling_date",
        "manager_id",
    ]
    
    # Capture current state of watched fields
    prev_state = {field: getattr(project, field) for field in audit_fields}
    
    update_data = project_in.model_dump(exclude_unset=True)
    
    # Apply updates
    for key, value in update_data.items():
        if key == "stage":
            _apply_stage_transition(project, value)
        else:
            setattr(project, key, value)

    if _is_won_project(project.stage) and not project.board_stage:
        project.board_stage = "TBC"

    # Capture new state of watched fields
    new_state = {field: getattr(project, field) for field in audit_fields}

    # Check for changes in tracked fields
    changesFound = any(prev_state[field] != new_state[field] for field in audit_fields)
    
    if changesFound:
        _sync_postgres_sequence(session, "projectauditlog")

        # Create Audit Log Record
        audit_entry = ProjectAuditLog(
            project_id=project.id,
            change_type="UPDATE",
            prev_state={k: str(v) if v is not None else None for k, v in prev_state.items()},
            new_state={k: str(v) if v is not None else None for k, v in new_state.items()}
        )
        session.add(audit_entry)

    session.add(project)
    try:
        session.commit()
    except IntegrityError as exc:
        session.rollback()
        logger.warning("Project update failed integrity check for id=%s: %s", project_id, exc)
        raise HTTPException(
            status_code=400,
            detail="Invalid project update payload (e.g., unknown manager/client reference).",
        ) from exc

    session.refresh(project)
    return _serialize_project(project)

@router.delete("/{project_id}")
def delete_project(project_id: int, session: Session = Depends(get_session)):
    """Delete a project and its associated data."""
    project = session.get(DashboardProject, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    session.delete(project)
    session.commit()
    return {"message": "Project deleted successfully"}

@router.get("/manager/{manager_id}", response_model=List[DashboardProjectRead])
def get_manager_projects(manager_id: int, session: Session = Depends(get_session)):
    """Fetch all projects assigned to a specific manager by ID."""
    query = select(DashboardProject).where(DashboardProject.manager_id == manager_id)
    projects = [
        project
        for project in session.exec(query).all()
        if _is_won_project(project.stage)
    ]
    return [_serialize_project(project) for project in projects]

@router.get("/availability-check")
def check_availability(
    start_date: py_date,
    end_date: Optional[py_date] = None,
    manager_id: Optional[int] = None,
    project_id: Optional[int] = None,
    session: Session = Depends(get_session)
):
    """Check manager availability using unified allocation dates on the project."""
    if manager_id:
        return {
            str(manager_id): is_manager_available(
                session=session,
                new_start=start_date,
                new_end=end_date,
                manager_id=manager_id,
                exclude_project_id=project_id,
            )
        }

    managers = session.exec(select(User).where(User.role == "PROJECT_MANAGER")).all()
    results = {}
    for m in managers:
        results[str(m.id)] = is_manager_available(
            session=session,
            new_start=start_date,
            new_end=end_date,
            manager_id=m.id,
            exclude_project_id=project_id,
        )

    return results

@router.get("/timeline")
def get_timeline_data(session: Session = Depends(get_session)):
    """
    Build timeline data by joining User and DashboardProject.
    Optimized to eliminate N+1 queries by fetching everything in a single JOIN.
    """
    try:
        from collections import defaultdict

        # Fetch all managers and their projects via LEFT JOIN
        stmt = (
            select(User, DashboardProject)
            .join(DashboardProject, User.id == DashboardProject.manager_id, isouter=True)
            .where(User.role == "PROJECT_MANAGER")
        )
        
        results = session.exec(stmt).all()
        
        manager_groups = defaultdict(lambda: {"manager": None, "allocations": []})

        for manager, project in results:
            if manager_groups[manager.id]["manager"] is None:
                manager_groups[manager.id]["manager"] = {
                    "id": manager.id,
                    "full_name": manager.full_name # Standard key
                }

            if (
                project is not None
                and _is_won_project(project.stage)
                and (
                    project.dispatch_date is not None
                    or project.event_start_date is not None
                )
            ):
                manager_groups[manager.id]["allocations"].append({
                    "id": project.id,
                    "project_id": project.id,
                    "crm_project_id": project.crm_project_id,
                    "project_name": project.project_name,
                    "manager_id": manager.id,
                    "allocation_start_date": project.allocation_start_date or project.dispatch_date or project.event_start_date,
                    "allocation_end_date": project.allocation_end_date or project.dismantling_date or project.event_end_date,
                    "project": {
                        "id": project.id,
                        "crm_project_id": project.crm_project_id,
                        "project_name": project.project_name,
                        "stage": _normalize_stage(project.stage),
                        "board_stage": project.board_stage,
                        "event_name": project.event_name,
                        "event_start_date": project.event_start_date,
                        "event_end_date": project.event_end_date,
                        "dispatch_date": project.dispatch_date,
                        "installation_start_date": project.installation_start_date,
                        "installation_end_date": project.installation_end_date,
                        "dismantling_date": project.dismantling_date,
                        "manager_id": project.manager_id,
                        "venue": project.venue,
                        "area": project.area,
                        "branch": project.branch
                    }
                })

        # Fetch unassigned projects
        unassigned_stmt = (
            select(DashboardProject)
            .where(DashboardProject.manager_id == None)
            .where(
                (DashboardProject.dispatch_date.is_not(None)) |
                (DashboardProject.event_start_date.is_not(None))
            )
        )
        unassigned_projects = [
            project
            for project in session.exec(unassigned_stmt).all()
            if _is_won_project(project.stage)
        ]
        
        if unassigned_projects:
            manager_groups["unassigned"] = {
                "manager": "Unassigned",
                "allocations": []
            }
            for project in unassigned_projects:
                manager_groups["unassigned"]["allocations"].append({
                    "id": project.id,
                    "project_id": project.id,
                    "crm_project_id": project.crm_project_id,
                    "project_name": project.project_name,
                    "manager_id": None,
                    "allocation_start_date": project.allocation_start_date or project.dispatch_date or project.event_start_date,
                    "allocation_end_date": project.allocation_end_date or project.dismantling_date or project.event_end_date,
                    "project": {
                        "id": project.id,
                        "crm_project_id": project.crm_project_id,
                        "project_name": project.project_name,
                        "stage": _normalize_stage(project.stage),
                        "board_stage": project.board_stage,
                        "event_name": project.event_name,
                        "event_start_date": project.event_start_date,
                        "event_end_date": project.event_end_date,
                        "dispatch_date": project.dispatch_date,
                        "installation_start_date": project.installation_start_date,
                        "installation_end_date": project.installation_end_date,
                        "dismantling_date": project.dismantling_date,
                        "manager_id": project.manager_id,
                        "venue": project.venue,
                        "area": project.area,
                        "branch": project.branch
                    }
                })

        # Sort helper to handle both dict managers and "Unassigned" string safely
        def sort_by_name(items):
            def manager_name(m):
                manager = m.get("manager")
                if isinstance(manager, dict):
                    return manager.get("full_name") or ""
                return str(manager or "")
            return sorted(items, key=manager_name)

        return sort_by_name(list(manager_groups.values()))

    except Exception as e:
        print(f"Timeline generation error: {e}")
        return []

@router.post("/managers")
def create_manager(manager_data: dict, session: Session = Depends(get_session)):
    """Create a new user with the PROJECT_MANAGER role."""
    name = manager_data.get("name")
    if not name:
        raise HTTPException(status_code=400, detail="Name is required")
    
    # Generate a dummy email based on name
    email = f"{name.lower().replace(' ', '.')}@insta-scm.com"
    
    # Check if user already exists
    existing = session.exec(select(User).where(User.email == email)).first()
    if existing:
        return {"id": existing.id, "full_name": existing.full_name}

    new_user = User(
        full_name=name,
        email=email,
        hashed_password="DUMMY_PASSWORD_SCM", # Placeholder for Gantt-created managers
        role="PROJECT_MANAGER",
        is_active=True
    )
    session.add(new_user)
    session.commit()
    session.refresh(new_user)
    return {"id": new_user.id, "full_name": new_user.full_name}

@router.delete("/managers/{manager_id}")
def delete_manager(manager_id: int, session: Session = Depends(get_session)):
    """Delete a manager user."""
    user = session.get(User, manager_id)
    if not user:
        raise HTTPException(status_code=404, detail="Manager not found")
    
    # Optional: Check if manager has projects
    projects = session.exec(select(DashboardProject).where(DashboardProject.manager_id == manager_id)).all()
    if projects:
        # Reassign projects to None before deleting manager
        for p in projects:
            p.manager_id = None
            session.add(p)
    
    session.delete(user)
    session.commit()
    return {"message": "Manager deleted successfully"}

@router.get("/pm-list")
def get_pm_list(session: Session = Depends(get_session)):
    """Fetch a simplified list of project managers for selection dropdowns."""
    query = select(User).where(User.role == "PROJECT_MANAGER")
    users = session.exec(query).all()
    return [{"id": u.id, "full_name": u.full_name} for u in users]

@router.get("/client-list")
def get_client_list(session: Session = Depends(get_session)):
    """Fetch all clients for selection dropdowns."""
    query = select(Client)
    clients = session.exec(query).all()
    return [{"id": c.id, "name": c.name} for c in clients]
