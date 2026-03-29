from typing import Optional
from datetime import date as py_date
from sqlmodel import SQLModel, Field, Relationship

class ManagerAllocationBase(SQLModel):
    manager_id: int = Field(foreign_key="manager.id", index=True)
    project_id: int = Field(foreign_key="dashboardproject.id", index=True)
    allocation_start_date: py_date
    allocation_end_date: Optional[py_date] = None

class ManagerAllocation(ManagerAllocationBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    
    # Relationships
    manager: Optional["Manager"] = Relationship(back_populates="allocations")
    project: Optional["DashboardProject"] = Relationship(back_populates="allocations")
