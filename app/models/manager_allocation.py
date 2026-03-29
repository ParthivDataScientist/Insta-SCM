from typing import Optional
from datetime import date as py_date
from sqlmodel import SQLModel, Field, Relationship
from pydantic import field_validator
from datetime import datetime
import pandas as pd

class ManagerAllocationBase(SQLModel):
    manager_id: int = Field(foreign_key="manager.id", index=True)
    project_id: int = Field(foreign_key="dashboardproject.id", index=True)
    allocation_start_date: py_date
    allocation_end_date: Optional[py_date] = None

    @field_validator(
        "allocation_start_date", "allocation_end_date",
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


class ManagerAllocation(ManagerAllocationBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    
    # Relationships
    manager: Optional["Manager"] = Relationship(back_populates="allocations")
    project: Optional["DashboardProject"] = Relationship(back_populates="allocations")
