from typing import Optional, List, Dict, Any
from datetime import date as py_date, datetime, timezone
from sqlmodel import Field, Relationship, Column, SQLModel
from sqlalchemy import Integer, ForeignKey, JSON, DateTime, func
from .base import AuditMixin

class Client(AuditMixin, table=True):
    """Normalized client table."""
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(index=True, unique=True, description="Unique name of the client.")
    industry: Optional[str] = None
    
    # Relationships
    projects: List["DashboardProject"] = Relationship(back_populates="client_relationship")

class ProjectAuditLog(SQLModel, table=True):
    """Semi-structured audit trail for project state changes."""
    id: Optional[int] = Field(default=None, primary_key=True)
    project_id: int = Field(foreign_key="dashboardproject.id", index=True)
    change_type: str = Field(default="UPDATE") # e.g., STAGE_CHANGE, DATE_CHANGE
    prev_state: Dict[str, Any] = Field(default={}, sa_column=Column(JSON))
    new_state: Dict[str, Any] = Field(default={}, sa_column=Column(JSON))
    changed_by_id: Optional[int] = Field(default=None, foreign_key="user.id")
    timestamp: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_type=DateTime(timezone=True),
        sa_column_kwargs={"server_default": func.now()},
    )

class DashboardProject(AuditMixin, table=True):
    """
    Main project entity containing stage, venue, and management data.
    Consolidated to act as the single source of truth for the SCM system.
    """
    id: Optional[int] = Field(default=None, primary_key=True)
    project_name: str = Field(index=True, description="Descriptive name of the project.")
    
    # Metadata
    client_id: Optional[int] = Field(
        default=None, 
        foreign_key="client.id", 
        description="Reference to the Client."
    )
    city: Optional[str] = Field(default=None, description="City where the project takes place.")
    event_name: Optional[str] = Field(default=None, description="Specific event branding.")
    team_type: Optional[str] = Field(default=None, description="Type of team assigned (e.g., In-house, Contractor).")
    
    # Dual-Stage Management
    stage: str = Field(default="Open", description="Sales stage (e.g., Open, Confirmed, Lost).")
    board_stage: str = Field(default="TBC", description="Kanban stage for confirmed projects.")
    
    # Location Details
    venue: Optional[str] = Field(default=None, description="Location/Venue of the project event.")
    area: Optional[str] = Field(default=None, description="Specific area within the venue.")
    branch: Optional[str] = Field(default=None, description="Corporate branch associated with the project.")
    
    # Manager Assignment
    manager_id: Optional[int] = Field(
        default=None, 
        foreign_key="user.id",
        description="Reference to the managing User."
    )
    
    # Timeline and Dates
    event_start_date: Optional[py_date] = Field(default=None)
    event_end_date: Optional[py_date] = Field(default=None)
    dispatch_date: Optional[py_date] = Field(default=None)
    installation_start_date: Optional[py_date] = Field(default=None)
    installation_end_date: Optional[py_date] = Field(default=None)
    dismantling_date: Optional[py_date] = Field(default=None)
    allocation_start_date: Optional[py_date] = Field(default=None)
    allocation_end_date: Optional[py_date] = Field(default=None)

    # Complex Data Storage
    comments: Optional[list] = Field(default=[], sa_column=Column(JSON))
    materials: Optional[list] = Field(default=[], sa_column=Column(JSON))
    photos: Optional[list] = Field(default=[], sa_column=Column(JSON))
    qc_steps: Optional[list] = Field(default=[], sa_column=Column(JSON))

    # Relationships
    manager: Optional["User"] = Relationship(back_populates="managed_projects")
    client_relationship: Optional[Client] = Relationship(back_populates="projects")
    audit_logs: List[ProjectAuditLog] = Relationship()
