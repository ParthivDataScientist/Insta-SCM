from typing import Optional, List
from sqlmodel import SQLModel, Field, Relationship

class ManagerBase(SQLModel):
    name: str = Field(index=True, unique=True)
    role: Optional[str] = None
    availability_status: Optional[str] = Field(default="Available")

class Manager(ManagerBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    
    # Relationships
    allocations: List["ManagerAllocation"] = Relationship(back_populates="manager")
