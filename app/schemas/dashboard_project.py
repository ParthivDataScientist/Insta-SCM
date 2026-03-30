from typing import Optional, List, Dict, Any
from pydantic import BaseModel
from datetime import datetime, date as py_date

class DashboardProjectCreate(BaseModel):
    project_name: str
    client_id: Optional[int] = None
    city: Optional[str] = None
    event_name: Optional[str] = None
    venue: Optional[str] = None
    area: Optional[str] = None
    branch: Optional[str] = None
    manager_id: Optional[int] = None
    stage: Optional[str] = "Open"
    board_stage: Optional[str] = "TBC"
    event_start_date: Optional[py_date] = None
    event_end_date: Optional[py_date] = None
    dispatch_date: Optional[py_date] = None
    installation_start_date: Optional[py_date] = None
    installation_end_date: Optional[py_date] = None
    dismantling_date: Optional[py_date] = None
    allocation_start_date: Optional[py_date] = None
    allocation_end_date: Optional[py_date] = None
    comments: Optional[list] = []
    materials: Optional[list] = []
    photos: Optional[list] = []
    qc_steps: Optional[list] = []

class DashboardProjectRead(DashboardProjectCreate):
    id: int
    project_manager: Optional[str] = None # For display and string-based filtering
    client: Optional[str] = None # For display and string-based filtering
    created_at: datetime
    updated_at: datetime

class DashboardProjectUpdate(BaseModel):
    project_name: Optional[str] = None
    client_id: Optional[int] = None
    city: Optional[str] = None
    event_name: Optional[str] = None
    venue: Optional[str] = None
    area: Optional[str] = None
    branch: Optional[str] = None
    manager_id: Optional[int] = None
    stage: Optional[str] = None
    board_stage: Optional[str] = None
    event_start_date: Optional[py_date] = None
    event_end_date: Optional[py_date] = None
    dispatch_date: Optional[py_date] = None
    installation_start_date: Optional[py_date] = None
    installation_end_date: Optional[py_date] = None
    dismantling_date: Optional[py_date] = None
    allocation_start_date: Optional[py_date] = None
    allocation_end_date: Optional[py_date] = None
    comments: Optional[list] = None
    materials: Optional[list] = None
    photos: Optional[list] = None
    qc_steps: Optional[list] = None