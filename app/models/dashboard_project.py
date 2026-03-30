from typing import Optional, List
from datetime import datetime, date as py_date, timezone
from sqlmodel import SQLModel, Field, Relationship
from sqlalchemy import Column, DateTime, func, JSON
from pydantic import field_validator
import pandas as pd


class DashboardProjectBase(SQLModel):
    date: Optional[py_date] = None
    project_name: str = Field(index=True)
    client: Optional[str] = None
    city: Optional[str] = None
    event_name: Optional[str] = None
    venue: Optional[str] = None
    area: Optional[str] = None
    event_start_date: Optional[py_date] = None
    event_end_date: Optional[py_date] = None
    material_dispatch_date: Optional[py_date] = None
    installation_start_date: Optional[py_date] = None
    installation_end_date: Optional[py_date] = None
    dismantling_date: Optional[py_date] = None
    project_manager: Optional[str] = None
    manager_id: Optional[int] = Field(default=None, foreign_key="manager.id")
    team_type: Optional[str] = None
    stage: Optional[str] = Field(default="Open") # e.g. Open, Confirmed, Lost
    branch: Optional[str] = None
    board_stage: Optional[str] = Field(default="TBC") # e.g. TBC, Approved, Material management, etc.
    comments: Optional[list] = Field(default=[], sa_column=Column(JSON))
    materials: Optional[list] = Field(default=[], sa_column=Column(JSON))
    photos: Optional[list] = Field(default=[], sa_column=Column(JSON))
    qc_steps: Optional[list] = Field(default=[], sa_column=Column(JSON))

    @field_validator(
        "date", "event_start_date", "event_end_date", "material_dispatch_date",
        "installation_start_date", "installation_end_date", "dismantling_date",
        mode="before", check_fields=False
    )
    @classmethod
    def robust_date_parser(cls, v):
        if not v:
            return None
        if isinstance(v, py_date) and not isinstance(v, datetime):
            return v
        if isinstance(v, datetime):
            return v.date()
        if isinstance(v, str):
            try:
                dt = pd.to_datetime(v, errors='coerce')
                if pd.notna(dt):
                    return dt.date()
            except:
                pass
        return v


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

    allocations: List["ManagerAllocation"] = Relationship(back_populates="project")
