from typing import Optional, List, Dict, Any
from pydantic import BaseModel
from datetime import datetime

class DashboardProjectCreate(BaseModel):
    date: Optional[str] = None
    project_name: str
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
    stage: Optional[str] = "Open"
    branch: Optional[str] = None
    board_stage: Optional[str] = "TBC"
    comments: Optional[list] = []
    materials: Optional[list] = []
    photos: Optional[list] = []
    qc_steps: Optional[list] = []

class DashboardProjectRead(DashboardProjectCreate):
    id: int
    created_at: datetime
    updated_at: datetime

class DashboardProjectUpdate(BaseModel):
    date: Optional[str] = None
    project_name: Optional[str] = None
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
    stage: Optional[str] = None
    branch: Optional[str] = None
    board_stage: Optional[str] = None
    comments: Optional[list] = None
    materials: Optional[list] = None
    photos: Optional[list] = None
    qc_steps: Optional[list] = None
    