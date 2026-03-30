import json
from datetime import date as py_date
from datetime import datetime, timezone
from typing import Any, List, Optional, Dict

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select, func, text
from sqlalchemy.exc import IntegrityError
import logging

from app.db.session import engine
from app.models.dashboard_project import DashboardProject, ProjectAuditLog, Client
from app.models.user import User
from app.schemas.dashboard_project import DashboardProjectCreate, DashboardProjectRead, DashboardProjectUpdate
from app.services.availability import is_manager_available

router = APIRouter()
logger = logging.getLogger(__name__)

def get_session():
    with Session(engine) as session:
        yield session

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

def _serialize_project(project: DashboardProject) -> DashboardProjectRead:
    """Enterprise-ready serialization mapping for DashboardProject."""
    return DashboardProjectRead(
        id=project.id,
        project_name=project.project_name or "Unknown",
        stage=project.stage or "Open",
        board_stage=project.board_stage or "TBC",
        venue=project.venue,
        area=project.area,
        branch=project.branch,
        manager_id=project.manager_id,
        project_manager=project.manager.full_name if project.manager else "Unassigned",
        client_id=project.client_id, # Added client_id
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
    """Calculate project statistics using the new 2-table schema."""
    projects = session.exec(select(DashboardProject)).all()

    total = len(projects)
    open_briefs = sum(1 for p in projects if p.stage and p.stage.lower() != "confirmed")
    won_projects = sum(1 for p in projects if p.stage and p.stage.lower() == "confirmed")

    # Unique branch count
    branches = {p.branch for p in projects if p.branch}
    # Unique PM count (from User table)
    pm_count = session.exec(select(func.count(User.id)).where(User.role == "PROJECT_MANAGER")).one()

    return {
        "total": total,
        "open_briefs": open_briefs,
        "won_projects": won_projects,
        "branches_count": len(branches),
        "pm_count": pm_count
    }

@router.get("/", response_model=List[DashboardProjectRead])
def get_projects(
    session: Session = Depends(get_session),
    stage: Optional[str] = None
):
    """Retrieve all projects, optionally filtered by stage."""
    query = select(DashboardProject)
    if stage:
        query = query.where(DashboardProject.stage == stage)
    
    projects = session.exec(query).all()
    return [_serialize_project(p) for p in projects]

@router.post("/", response_model=DashboardProjectRead)
def create_project(project_in: DashboardProjectCreate, session: Session = Depends(get_session)):
    """Create a new project in the unified schema."""
    project = DashboardProject.model_validate(project_in)
    session.add(project)
    session.commit()
    session.refresh(project)
    return _serialize_project(project)

@router.put("/{project_id}", response_model=DashboardProjectRead)
def update_project(project_id: int, project_in: DashboardProjectUpdate, session: Session = Depends(get_session)):
    """Update an existing project's details with automatic audit logging."""
    project = session.get(DashboardProject, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Fields to monitor for Audit Logging
    audit_fields = ["stage", "dispatch_date", "dismantling_date", "manager_id"]
    
    # Capture current state of watched fields
    prev_state = {field: getattr(project, field) for field in audit_fields}
    
    update_data = project_in.model_dump(exclude_unset=True)
    
    # Apply updates
    for key, value in update_data.items():
        setattr(project, key, value)

    # Capture new state of watched fields
    new_state = {field: getattr(project, field) for field in audit_fields}

    # Check for changes in tracked fields
    changesFound = any(prev_state[field] != new_state[field] for field in audit_fields)
    
    if changesFound:
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
    projects = session.exec(query).all()
    return [_serialize_project(p) for p in projects]

@router.get("/availability-check")
def check_availability(
    start_date: py_date,
    end_date: Optional[py_date] = None,
    manager_id: Optional[int] = None,
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

            if project is not None and (project.dispatch_date is not None or project.event_start_date is not None):
                manager_groups[manager.id]["allocations"].append({
                    "id": project.id,
                    "project_id": project.id,
                    "project_name": project.project_name,
                    "manager_id": manager.id,
                    "allocation_start_date": project.dispatch_date,
                    "allocation_end_date": project.dismantling_date,
                    "project": {
                        "id": project.id,
                        "project_name": project.project_name,
                        "stage": project.stage,
                        "board_stage": project.board_stage,
                        "venue": project.venue,
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
        unassigned_projects = session.exec(unassigned_stmt).all()
        
        if unassigned_projects:
            manager_groups["unassigned"] = {
                "manager": "Unassigned",
                "allocations": []
            }
            for project in unassigned_projects:
                manager_groups["unassigned"]["allocations"].append({
                    "id": project.id,
                    "project_id": project.id,
                    "project_name": project.project_name,
                    "manager_id": None,
                    "allocation_start_date": project.dispatch_date,
                    "allocation_end_date": project.dismantling_date,
                    "project": {
                        "id": project.id,
                        "project_name": project.project_name,
                        "stage": project.stage,
                        "board_stage": project.board_stage,
                        "venue": project.venue,
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
