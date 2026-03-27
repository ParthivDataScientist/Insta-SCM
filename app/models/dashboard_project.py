from typing import Optional
from datetime import datetime, timezone
from sqlmodel import SQLModel, Field
from sqlalchemy import Column, DateTime, func, JSON


class DashboardProjectBase(SQLModel):
    date: Optional[str] = None
    project_name: str = Field(index=True)
    client: Optional[str] = None
    city: Optional[str] = None
    event_name: Optional[str] = None
    venue: Optional[str] = None
    area: Optional[str] = None
    event_start_date: Optional[str] = None
    material_dispatch_date: Optional[str] = None
    installation_start_date: Optional[str] = None
    installation_end_date: Optional[str] = None
    dismantling_date: Optional[str] = None
    project_manager: Optional[str] = None
    team_type: Optional[str] = None
    stage: Optional[str] = Field(default="Open") # e.g. Open, Confirmed, Lost
    branch: Optional[str] = None
    board_stage: Optional[str] = Field(default="TBC") # e.g. TBC, Approved, Material management, etc.
    comments: Optional[list] = Field(default=[], sa_column=Column(JSON))
    materials: Optional[list] = Field(default=[], sa_column=Column(JSON))
    photos: Optional[list] = Field(default=[], sa_column=Column(JSON))
    qc_steps: Optional[list] = Field(default=[], sa_column=Column(JSON))


class DashboardProject(DashboardProjectBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_column=Column(DateTime(timezone=True), default=func.now(), nullable=False),
    )
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_column=Column(
            DateTime(timezone=True),
            default=func.now(),
            onupdate=func.now(),
            nullable=False,
        ),
    )
