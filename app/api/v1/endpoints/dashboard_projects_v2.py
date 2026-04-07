import json
import logging
from collections import defaultdict
from datetime import date as py_date
from datetime import datetime, timezone
from typing import Any, Iterable, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, func, select, text

from app.db.session import get_session
from app.models.dashboard_project import Client, DashboardProject, ProjectAuditLog, ProjectLink
from app.models.shipment import Shipment
from app.models.user import User
from app.schemas.dashboard_project import (
    DashboardProjectCreate,
    DashboardProjectRead,
    DashboardProjectUpdate,
    ProjectLinkCreate,
    ProjectLinkRead,
    ProjectLinkUpdate,
)
from app.services.availability import is_manager_available

router = APIRouter()
logger = logging.getLogger(__name__)

WIN_STAGE_ALIASES = {"win", "won", "confirmed"}
DROP_STAGE_ALIASES = {"drop", "dropped", "lost"}
DESIGN_ITERATION_ALIASES = {"design change", "design-change", "design_change"}
IN_PROCESS_ALIASES = {"open", "in-process", "in process", "in_progress", "in-progress"}

CANONICAL_STATUS_ALIASES = {
    "pending": "pending",
    "not_started": "pending",
    "not-started": "pending",
    "in_progress": "in_progress",
    "in-progress": "in_progress",
    "in progress": "in_progress",
    "changes": "changes",
    "change": "changes",
    "revision": "changes",
    "revisions": "changes",
    "won": "won",
    "win": "won",
    "approved": "won",
    "lost": "lost",
    "drop": "lost",
    "dropped": "lost",
}
LEGACY_PENDING_ALIASES = {"brief", "design", "negotiation", "open"}

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
        "status": "in_progress",
        "current_version": "V1",
        "revision_count": 0,
        "booking_date": py_date(2026, 4, 1),
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
        "status": "changes",
        "current_version": "V2",
        "revision_count": 1,
        "revision_history": [
            {"version": "V1", "timestamp": "2026-03-10T10:00:00+00:00", "notes": "Initial design submitted"},
            {"version": "V2", "timestamp": "2026-03-15T12:00:00+00:00", "notes": "Client requested booth revisions"},
        ],
        "booking_date": py_date(2026, 3, 7),
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
        "status": "lost",
        "booking_date": py_date(2026, 3, 12),
        "event_start_date": py_date(2026, 5, 4),
        "event_end_date": py_date(2026, 5, 8),
    },
]


def _sync_postgres_sequence(session: Session, table_name: str, column_name: str = "id") -> None:
    bind = session.get_bind()
    if bind is None or bind.dialect.name != "postgresql":
        return

    sync_stmt = text(f"""
        SELECT setval(
            pg_get_serial_sequence(:table_name, :column_name), 
            COALESCE((SELECT MAX({column_name}) FROM {table_name}), 0) + 1, 
            false
        )
    """)
    session.exec(sync_stmt, params={"table_name": table_name, "column_name": column_name})


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


def _coerce_revision_history(value: Any) -> list[dict[str, Any]]:
    history = []
    for entry in _coerce_list(value):
        if isinstance(entry, dict):
            history.append(
                {
                    "version": entry.get("version"),
                    "timestamp": entry.get("timestamp"),
                    "notes": entry.get("notes"),
                }
            )
    return history


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


def _stage_from_status(status: str) -> str:
    return {
        "pending": "Open",
        "in_progress": "In-Process",
        "changes": "Design Change",
        "won": "Win",
        "lost": "Drop",
    }.get(status, "Open")


def _normalize_status_value(status: Optional[str]) -> Optional[str]:
    if status is None:
        return None
    return CANONICAL_STATUS_ALIASES.get((status or "").strip().lower())


def _normalize_current_version(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    raw = str(value).strip()
    return raw or None


def _derive_status(status: Optional[str], stage: Optional[str], revision_count: int, current_version: Optional[str]) -> str:
    explicit = _normalize_status_value(status)
    if explicit:
        return explicit

    normalized_stage = _normalize_stage(stage)
    raw_stage = (stage or "").strip().lower()
    if normalized_stage == "Win":
        return "won"
    if normalized_stage == "Drop":
        return "lost"
    if normalized_stage == "Design Change" or revision_count > 0:
        return "changes"
    if normalized_stage == "In-Process":
        return "in_progress"
    if raw_stage in LEGACY_PENDING_ALIASES or not raw_stage:
        return "pending"
    return "pending"


def _default_revision_note(status: str, current_version: Optional[str]) -> str:
    if status == "in_progress":
        return "Initial design submitted"
    if status == "changes":
        return f"Revision {current_version or 'update'} recorded"
    return "Design state updated"


def _apply_design_state(project: DashboardProject, payload: dict[str, Any]) -> None:
    previous_history = _coerce_revision_history(getattr(project, "revision_history", []))
    explicit_history = payload.get("revision_history")
    revision_history = _coerce_revision_history(explicit_history) if explicit_history is not None else previous_history
    revision_note = payload.pop("revision_note", None)

    for key, value in payload.items():
        if key in {"revision_history", "revision_note"}:
            continue
        setattr(project, key, value)

    normalized_stage = _normalize_stage(getattr(project, "stage", None))
    revision_count = max(0, int(getattr(project, "revision_count", 0) or 0))
    current_version = _normalize_current_version(getattr(project, "current_version", None))
    status_source = getattr(project, "status", None) if ("status" in payload or "stage" not in payload) else None
    status = _derive_status(status_source, normalized_stage, revision_count, current_version)

    project.status = status
    if payload.get("status") is not None or payload.get("stage") is not None:
        project.stage = _stage_from_status(status)
    else:
        project.stage = normalized_stage
    project.revision_count = revision_count
    project.current_version = current_version
    project.is_active = bool(payload["is_active"]) if "is_active" in payload else status not in {"won", "lost"}

    if project.stage == "Win" and not project.board_stage:
        project.board_stage = "TBC"
    if payload.get("booking_date") == "":
        project.booking_date = None

    project.revision_history = revision_history


def _is_won_project(stage: Optional[str]) -> bool:
    return _normalize_stage(stage) == "Win"


def _build_awb_map(session: Session) -> dict[int, list[str]]:
    awb_map: dict[int, set[str]] = defaultdict(set)
    shipments = session.exec(select(Shipment).where(Shipment.project_id.is_not(None))).all()
    for shipment in shipments:
        if shipment.project_id is None:
            continue
        if shipment.tracking_number:
            awb_map[shipment.project_id].add(shipment.tracking_number)
        if shipment.master_tracking_number:
            awb_map[shipment.project_id].add(shipment.master_tracking_number)
        for child in shipment.child_parcels or []:
            tracking = child.get("tracking_number")
            if tracking:
                awb_map[shipment.project_id].add(tracking)
    return {project_id: sorted(values) for project_id, values in awb_map.items()}


def _serialize_project(project: DashboardProject, awb_map: Optional[dict[int, list[str]]] = None) -> DashboardProjectRead:
    awb_values = (awb_map or {}).get(project.id or -1, [])
    return DashboardProjectRead(
        id=project.id,
        crm_project_id=project.crm_project_id,
        project_name=project.project_name or "Unknown",
        city=project.city,
        event_name=project.event_name,
        venue=project.venue,
        area=project.area,
        branch=project.branch,
        manager_id=project.manager_id,
        project_manager=project.manager.full_name if project.manager else "Unassigned",
        client_id=project.client_id,
        client=project.client_relationship.name if project.client_relationship else "No Client",
        stage=_normalize_stage(project.stage),
        board_stage=project.board_stage or "TBC",
        status=_derive_status(project.status, project.stage, project.revision_count, project.current_version),
        revision_count=max(0, int(project.revision_count or 0)),
        current_version=_normalize_current_version(project.current_version),
        is_active=bool(project.is_active),
        booking_date=project.booking_date,
        revision_history=_coerce_revision_history(getattr(project, "revision_history", [])),
        linked_awbs=awb_values,
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


def _serialize_project_link(link: ProjectLink) -> ProjectLinkRead:
    return ProjectLinkRead(
        id=link.id,
        project_id=link.project_id,
        link_type=link.link_type,
        label=link.label,
        url=link.url,
        created_by=link.created_by,
        created_at=link.created_at,
        updated_at=link.updated_at,
    )


def _project_matches_search(project: DashboardProject, query: str, awbs: Iterable[str]) -> bool:
    q = query.strip().lower()
    if not q:
        return True

    searchable = [
        project.crm_project_id or "",
        project.project_name or "",
        project.event_name or "",
        project.venue or "",
        project.city or "",
        project.branch or "",
        project.current_version or "",
        project.client_relationship.name if project.client_relationship else "",
    ]
    searchable.extend(awbs)
    return any(q in value.lower() for value in searchable if value)


def _filter_design_projects(
    session: Session,
    *,
    status: Optional[str] = None,
    client_id: Optional[int] = None,
    client_name: Optional[str] = None,
    city: Optional[str] = None,
    search: Optional[str] = None,
    date_field: str = "show",
    start_date: Optional[py_date] = None,
    end_date: Optional[py_date] = None,
) -> tuple[list[DashboardProject], dict[int, list[str]]]:
    projects = session.exec(select(DashboardProject)).all()
    awb_map = _build_awb_map(session)
    desired_status = _normalize_status_value(status) if status and status.lower() != "all" else None
    desired_city = (city or "").strip().lower()
    desired_client_name = (client_name or "").strip().lower()

    def passes(project: DashboardProject) -> bool:
        canonical_status = _derive_status(project.status, project.stage, project.revision_count, project.current_version)
        if desired_status and canonical_status != desired_status:
            return False
        if client_id is not None and project.client_id != client_id:
            return False
        if desired_client_name:
            client_value = (project.client_relationship.name if project.client_relationship else "").strip().lower()
            if client_value != desired_client_name:
                return False
        if desired_city and (project.city or "").strip().lower() != desired_city:
            return False
        date_value = project.booking_date if (date_field or "show").lower() == "booking" else project.event_start_date
        if (start_date or end_date) and not date_value:
            return False
        if start_date and date_value and date_value < start_date:
            return False
        if end_date and date_value and date_value > end_date:
            return False
        if search and not _project_matches_search(project, search, awb_map.get(project.id or -1, [])):
            return False
        return True

    filtered = [project for project in projects if passes(project)]
    return filtered, awb_map


@router.get("/stats")
def get_project_stats(session: Session = Depends(get_session)):
    projects = session.exec(select(DashboardProject)).all()
    execution_projects = [project for project in projects if _is_won_project(project.stage)]
    branches = {project.branch for project in execution_projects if project.branch}
    pm_count = session.exec(select(func.count(User.id)).where(User.role == "PROJECT_MANAGER")).one()

    return {
        "total": len(execution_projects),
        "open_briefs": sum(1 for project in projects if _normalize_stage(project.stage) == "In-Process"),
        "won_projects": len(execution_projects),
        "branches_count": len(branches),
        "pm_count": pm_count,
    }


@router.get("/designs/stats")
def get_design_stats(
    session: Session = Depends(get_session),
    status: Optional[str] = None,
    client_id: Optional[int] = None,
    client_name: Optional[str] = None,
    city: Optional[str] = None,
    search: Optional[str] = None,
    date_field: str = Query(default="show"),
    start_date: Optional[py_date] = None,
    end_date: Optional[py_date] = None,
):
    projects, _ = _filter_design_projects(
        session,
        status=status,
        client_id=client_id,
        client_name=client_name,
        city=city,
        search=search,
        date_field=date_field,
        start_date=start_date,
        end_date=end_date,
    )

    counts = defaultdict(int)
    for project in projects:
        counts[_derive_status(project.status, project.stage, project.revision_count, project.current_version)] += 1

    total_brief = len(projects)
    won_count = counts["won"]
    lost_count = counts["lost"]
    return {
        "total_brief": total_brief,
        "pending_count": counts["pending"],
        "in_progress_count": counts["in_progress"],
        "changes_count": counts["changes"],
        "won_count": won_count,
        "lost_count": lost_count,
        "open_count": total_brief - (won_count + lost_count),
    }


@router.get("/crm/designs")
def get_crm_design_feed():
    return CRM_DESIGN_FEED


@router.get("/designs", response_model=List[DashboardProjectRead])
def get_design_projects(
    session: Session = Depends(get_session),
    status: Optional[str] = None,
    client_id: Optional[int] = None,
    client_name: Optional[str] = None,
    city: Optional[str] = None,
    search: Optional[str] = None,
    date_field: str = Query(default="show"),
    start_date: Optional[py_date] = None,
    end_date: Optional[py_date] = None,
):
    projects, awb_map = _filter_design_projects(
        session,
        status=status,
        client_id=client_id,
        client_name=client_name,
        city=city,
        search=search,
        date_field=date_field,
        start_date=start_date,
        end_date=end_date,
    )
    return [_serialize_project(project, awb_map) for project in projects]


@router.post("/crm/designs/sync")
def sync_crm_design_feed(session: Session = Depends(get_session)):
    upserted = 0
    for crm_record in CRM_DESIGN_FEED:
        project = session.exec(
            select(DashboardProject).where(DashboardProject.crm_project_id == crm_record["crm_project_id"])
        ).first()
        already_won = bool(project and _is_won_project(project.stage))

        if not project:
            project = DashboardProject(
                crm_project_id=crm_record["crm_project_id"],
                project_name=crm_record["project_name"],
                board_stage="TBC",
            )

        payload = dict(crm_record)
        if already_won:
            payload["status"] = "won"
            payload["stage"] = "Win"

        _apply_design_state(project, payload)
        session.add(project)
        upserted += 1

    session.commit()
    return {"message": "CRM design feed synchronized", "upserted": upserted, "records": CRM_DESIGN_FEED}


@router.post("/designs/{project_id}/win", response_model=DashboardProjectRead)
def convert_design_to_project(project_id: int, session: Session = Depends(get_session)):
    project = session.get(DashboardProject, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    _apply_design_state(project, {"status": "won", "stage": "Win"})
    project.board_stage = project.board_stage or "TBC"
    session.add(project)
    session.commit()
    session.refresh(project)
    awb_map = _build_awb_map(session)
    return _serialize_project(project, awb_map)


@router.get("/", response_model=List[DashboardProjectRead])
def get_projects(
    session: Session = Depends(get_session),
    stage: Optional[str] = None,
    scope: str = Query(default="execution"),
):
    projects = session.exec(select(DashboardProject)).all()
    awb_map = _build_awb_map(session)

    if scope == "execution":
        projects = [project for project in projects if _is_won_project(project.stage)]
    elif scope == "design":
        pass
    elif scope != "all":
        raise HTTPException(status_code=400, detail="scope must be one of: execution, design, all")

    if stage:
        normalized_stage = _normalize_stage(stage)
        projects = [project for project in projects if _normalize_stage(project.stage) == normalized_stage]

    return [_serialize_project(project, awb_map) for project in projects]


@router.post("/", response_model=DashboardProjectRead)
def create_project(project_in: DashboardProjectCreate, session: Session = Depends(get_session)):
    payload = project_in.model_dump(exclude_unset=True)
    project = DashboardProject(project_name=payload.get("project_name") or "Untitled Project")
    _apply_design_state(project, payload)
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
    awb_map = _build_awb_map(session)
    return _serialize_project(project, awb_map)


@router.put("/{project_id}", response_model=DashboardProjectRead)
def update_project(project_id: int, project_in: DashboardProjectUpdate, session: Session = Depends(get_session)):
    project = session.get(DashboardProject, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    audit_fields = [
        "stage",
        "status",
        "board_stage",
        "dispatch_date",
        "dismantling_date",
        "manager_id",
        "revision_count",
        "current_version",
    ]
    prev_state = {field: getattr(project, field) for field in audit_fields}
    update_data = project_in.model_dump(exclude_unset=True)
    _apply_design_state(project, update_data)

    new_state = {field: getattr(project, field) for field in audit_fields}
    if any(prev_state[field] != new_state[field] for field in audit_fields):
        _sync_postgres_sequence(session, "projectauditlog")
        session.add(
            ProjectAuditLog(
                project_id=project.id,
                change_type="UPDATE",
                prev_state={k: str(v) if v is not None else None for k, v in prev_state.items()},
                new_state={k: str(v) if v is not None else None for k, v in new_state.items()},
            )
        )

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
    awb_map = _build_awb_map(session)
    return _serialize_project(project, awb_map)


@router.delete("/{project_id}")
def delete_project(project_id: int, session: Session = Depends(get_session)):
    project = session.get(DashboardProject, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    active_shipments = session.exec(
        select(Shipment).where(
            Shipment.project_id == project_id,
            Shipment.is_archived == False,
        )
    ).all()
    if active_shipments:
        raise HTTPException(
            status_code=400,
            detail="Cannot delete a project with active linked shipments. Archive or reassign the shipments first.",
        )

    linked_links = session.exec(select(ProjectLink).where(ProjectLink.project_id == project_id)).all()
    for link in linked_links:
        session.delete(link)
    session.delete(project)
    session.commit()
    return {"message": "Project deleted successfully"}


@router.get("/{project_id}/links", response_model=List[ProjectLinkRead])
def get_project_links(project_id: int, session: Session = Depends(get_session)):
    project = session.get(DashboardProject, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    links = session.exec(
        select(ProjectLink)
        .where(ProjectLink.project_id == project_id)
        .order_by(ProjectLink.created_at.desc())
    ).all()
    return [_serialize_project_link(link) for link in links]


@router.post("/{project_id}/links", response_model=ProjectLinkRead)
def create_project_link(
    project_id: int,
    payload: ProjectLinkCreate,
    session: Session = Depends(get_session),
):
    project = session.get(DashboardProject, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    duplicate = session.exec(
        select(ProjectLink).where(
            ProjectLink.project_id == project_id,
            ProjectLink.url == payload.url,
        )
    ).first()
    if duplicate:
        raise HTTPException(status_code=400, detail="This link already exists for the project")

    link = ProjectLink(
        project_id=project_id,
        link_type=payload.link_type,
        label=payload.label,
        url=payload.url,
    )
    session.add(link)
    session.commit()
    session.refresh(link)
    return _serialize_project_link(link)


@router.put("/{project_id}/links/{link_id}", response_model=ProjectLinkRead)
def update_project_link(
    project_id: int,
    link_id: int,
    payload: ProjectLinkUpdate,
    session: Session = Depends(get_session),
):
    link = session.get(ProjectLink, link_id)
    if not link or link.project_id != project_id:
        raise HTTPException(status_code=404, detail="Project link not found")

    update_data = payload.model_dump(exclude_unset=True)
    if "url" in update_data:
        duplicate = session.exec(
            select(ProjectLink).where(
                ProjectLink.project_id == project_id,
                ProjectLink.url == update_data["url"],
                ProjectLink.id != link_id,
            )
        ).first()
        if duplicate:
            raise HTTPException(status_code=400, detail="This link already exists for the project")

    for key, value in update_data.items():
        setattr(link, key, value)

    session.add(link)
    session.commit()
    session.refresh(link)
    return _serialize_project_link(link)


@router.delete("/{project_id}/links/{link_id}")
def delete_project_link(project_id: int, link_id: int, session: Session = Depends(get_session)):
    link = session.get(ProjectLink, link_id)
    if not link or link.project_id != project_id:
        raise HTTPException(status_code=404, detail="Project link not found")

    session.delete(link)
    session.commit()
    return {"message": "Project link deleted successfully"}


@router.get("/manager/{manager_id}", response_model=List[DashboardProjectRead])
def get_manager_projects(manager_id: int, session: Session = Depends(get_session)):
    query = select(DashboardProject).where(DashboardProject.manager_id == manager_id)
    awb_map = _build_awb_map(session)
    projects = [project for project in session.exec(query).all() if _is_won_project(project.stage)]
    return [_serialize_project(project, awb_map) for project in projects]


@router.get("/availability-check")
def check_availability(
    start_date: py_date,
    end_date: Optional[py_date] = None,
    manager_id: Optional[int] = None,
    project_id: Optional[int] = None,
    session: Session = Depends(get_session),
):
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
    for manager in managers:
        results[str(manager.id)] = is_manager_available(
            session=session,
            new_start=start_date,
            new_end=end_date,
            manager_id=manager.id,
            exclude_project_id=project_id,
        )
    return results


@router.get("/timeline")
def get_timeline_data(session: Session = Depends(get_session)):
    try:
        stmt = (
            select(User, DashboardProject)
            .join(DashboardProject, User.id == DashboardProject.manager_id, isouter=True)
            .where(User.role == "PROJECT_MANAGER")
        )
        results = session.exec(stmt).all()
        manager_groups = defaultdict(lambda: {"manager": None, "allocations": []})

        for manager, project in results:
            if manager_groups[manager.id]["manager"] is None:
                manager_groups[manager.id]["manager"] = {"id": manager.id, "full_name": manager.full_name}

            if (
                project is not None
                and _is_won_project(project.stage)
                and (project.dispatch_date is not None or project.event_start_date is not None)
            ):
                manager_groups[manager.id]["allocations"].append(
                    {
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
                            "status": _derive_status(project.status, project.stage, project.revision_count, project.current_version),
                            "current_version": _normalize_current_version(project.current_version),
                            "revision_count": max(0, int(project.revision_count or 0)),
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
                            "branch": project.branch,
                        },
                    }
                )

        unassigned_stmt = (
            select(DashboardProject)
            .where(DashboardProject.manager_id == None)
            .where((DashboardProject.dispatch_date.is_not(None)) | (DashboardProject.event_start_date.is_not(None)))
        )
        unassigned_projects = [project for project in session.exec(unassigned_stmt).all() if _is_won_project(project.stage)]
        if unassigned_projects:
            manager_groups["unassigned"] = {"manager": "Unassigned", "allocations": []}
            for project in unassigned_projects:
                manager_groups["unassigned"]["allocations"].append(
                    {
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
                            "status": _derive_status(project.status, project.stage, project.revision_count, project.current_version),
                            "current_version": _normalize_current_version(project.current_version),
                            "revision_count": max(0, int(project.revision_count or 0)),
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
                            "branch": project.branch,
                        },
                    }
                )

        def sort_by_name(items):
            def manager_name(item):
                manager = item.get("manager")
                if isinstance(manager, dict):
                    return manager.get("full_name") or ""
                return str(manager or "")

            return sorted(items, key=manager_name)

        return sort_by_name(list(manager_groups.values()))
    except Exception as exc:
        logger.exception("Timeline generation error: %s", exc)
        return []


@router.post("/managers")
def create_manager(manager_data: dict, session: Session = Depends(get_session)):
    name = manager_data.get("name")
    if not name:
        raise HTTPException(status_code=400, detail="Name is required")

    email = f"{name.lower().replace(' ', '.')}@insta-scm.com"
    existing = session.exec(select(User).where(User.email == email)).first()
    if existing:
        return {"id": existing.id, "full_name": existing.full_name}

    new_user = User(
        full_name=name,
        email=email,
        hashed_password="DUMMY_PASSWORD_SCM",
        role="PROJECT_MANAGER",
        is_active=True,
    )
    session.add(new_user)
    session.commit()
    session.refresh(new_user)
    return {"id": new_user.id, "full_name": new_user.full_name}


@router.delete("/managers/{manager_id}")
def delete_manager(manager_id: int, session: Session = Depends(get_session)):
    user = session.get(User, manager_id)
    if not user:
        raise HTTPException(status_code=404, detail="Manager not found")

    projects = session.exec(select(DashboardProject).where(DashboardProject.manager_id == manager_id)).all()
    for project in projects:
        project.manager_id = None
        session.add(project)

    session.delete(user)
    session.commit()
    return {"message": "Manager deleted successfully"}


@router.get("/pm-list")
def get_pm_list(session: Session = Depends(get_session)):
    users = session.exec(select(User).where(User.role == "PROJECT_MANAGER")).all()
    return [{"id": user.id, "full_name": user.full_name} for user in users]


@router.get("/client-list")
def get_client_list(session: Session = Depends(get_session)):
    clients = session.exec(select(Client)).all()
    return [{"id": client.id, "name": client.name} for client in clients]
