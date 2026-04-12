from typing import Optional, List, Dict, Any
from pydantic import BaseModel, field_validator, model_validator
from datetime import datetime, date as py_date
from urllib.parse import urlparse


ALLOWED_LINK_SCHEMES = {"http", "https"}
ALLOWED_RESOURCE_TYPES = {"design", "autocad", "graphic_file"}
ALLOWED_RESOURCE_SOURCE_TYPES = {"link", "file"}

class DashboardProjectCreate(BaseModel):
    crm_project_id: Optional[str] = None
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
    status: Optional[str] = "pending"
    priority: Optional[str] = "medium"
    revision_count: Optional[int] = 0
    current_version: Optional[str] = None
    is_active: Optional[bool] = True
    booking_date: Optional[py_date] = None
    revision_history: Optional[list] = []
    revision_note: Optional[str] = None
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

    @field_validator(
        "event_start_date", "event_end_date", "dispatch_date",
        "installation_start_date", "installation_end_date",
        "dismantling_date", "allocation_start_date", "allocation_end_date", "booking_date",
        mode="before"
    )
    @classmethod
    def parse_empty_date_create(cls, v):
        if v == "":
            return None
        return v

class DashboardProjectRead(DashboardProjectCreate):
    id: int
    project_manager: Optional[str] = None # For display and string-based filtering
    client: Optional[str] = None # For display and string-based filtering
    linked_awbs: List[str] = []
    created_at: datetime
    updated_at: datetime

class DashboardProjectUpdate(BaseModel):
    crm_project_id: Optional[str] = None
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
    status: Optional[str] = None
    priority: Optional[str] = None
    revision_count: Optional[int] = None
    current_version: Optional[str] = None
    is_active: Optional[bool] = None
    booking_date: Optional[py_date] = None
    revision_history: Optional[list] = None
    revision_note: Optional[str] = None
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

    @field_validator(
        "event_start_date", "event_end_date", "dispatch_date",
        "installation_start_date", "installation_end_date",
        "dismantling_date", "allocation_start_date", "allocation_end_date", "booking_date",
        mode="before"
    )
    @classmethod
    def parse_empty_date_update(cls, v):
        if v == "":
            return None
        return v


class ProjectLinkBase(BaseModel):
    link_type: str = "other"
    label: str
    url: str

    @field_validator("link_type", mode="before")
    @classmethod
    def normalize_link_type(cls, value):
        raw = (value or "other").strip().lower()
        return raw if raw in {"drive", "autocad", "render", "other"} else "other"

    @field_validator("label")
    @classmethod
    def validate_label(cls, value):
        if not value or not value.strip():
            raise ValueError("Label is required")
        return value.strip()

    @field_validator("url")
    @classmethod
    def validate_url(cls, value):
        parsed = urlparse((value or "").strip())
        if parsed.scheme.lower() not in ALLOWED_LINK_SCHEMES or not parsed.netloc:
            raise ValueError("Only valid http/https URLs are allowed")
        return value.strip()


class ProjectLinkCreate(ProjectLinkBase):
    pass


class ProjectLinkUpdate(BaseModel):
    link_type: Optional[str] = None
    label: Optional[str] = None
    url: Optional[str] = None

    @field_validator("link_type", mode="before")
    @classmethod
    def normalize_optional_link_type(cls, value):
        if value is None:
            return value
        raw = value.strip().lower()
        return raw if raw in {"drive", "autocad", "render", "other"} else "other"

    @field_validator("label")
    @classmethod
    def validate_optional_label(cls, value):
        if value is None:
            return value
        if not value.strip():
            raise ValueError("Label is required")
        return value.strip()

    @field_validator("url")
    @classmethod
    def validate_optional_url(cls, value):
        if value is None:
            return value
        parsed = urlparse(value.strip())
        if parsed.scheme.lower() not in ALLOWED_LINK_SCHEMES or not parsed.netloc:
            raise ValueError("Only valid http/https URLs are allowed")
        return value.strip()


class ProjectLinkRead(ProjectLinkBase):
    id: int
    project_id: int
    created_by: Optional[int] = None
    created_at: datetime
    updated_at: datetime


class ProjectResourceVersionCreate(BaseModel):
    entry_key: Optional[str] = None
    label: str
    source_type: str = "link"
    url: Optional[str] = None
    file_name: Optional[str] = None
    file_content: Optional[str] = None
    mime_type: Optional[str] = None

    @field_validator("label")
    @classmethod
    def validate_resource_label(cls, value):
        if not value or not value.strip():
            raise ValueError("Label is required")
        return value.strip()

    @field_validator("entry_key")
    @classmethod
    def normalize_entry_key(cls, value):
        if value is None:
            return value
        cleaned = value.strip()
        return cleaned or None

    @field_validator("source_type", mode="before")
    @classmethod
    def normalize_source_type(cls, value):
        raw = (value or "link").strip().lower()
        return raw if raw in ALLOWED_RESOURCE_SOURCE_TYPES else "link"

    @field_validator("url")
    @classmethod
    def validate_resource_url(cls, value):
        if value is None:
            return value
        parsed = urlparse(value.strip())
        if parsed.scheme.lower() not in ALLOWED_LINK_SCHEMES or not parsed.netloc:
            raise ValueError("Only valid http/https URLs are allowed")
        return value.strip()

    @field_validator("file_name", "file_content", "mime_type")
    @classmethod
    def strip_optional_resource_values(cls, value):
        if value is None:
            return value
        cleaned = value.strip()
        return cleaned or None

    @model_validator(mode="after")
    def validate_payload_shape(self):
        if self.source_type == "link":
            if not self.url:
                raise ValueError("URL is required for link resources")
        elif self.source_type == "file":
            if not self.file_name or not self.file_content:
                raise ValueError("file_name and file_content are required for file resources")
        return self


class ProjectResourceVersionRead(BaseModel):
    id: int
    project_id: int
    resource_type: str
    entry_key: str
    label: str
    version_number: int
    version_label: str
    source_type: str
    url: Optional[str] = None
    file_name: Optional[str] = None
    file_content: Optional[str] = None
    mime_type: Optional[str] = None
    created_by: Optional[int] = None
    created_at: datetime
    updated_at: datetime


class ProjectResourceEntryRead(BaseModel):
    entry_key: str
    project_id: int
    resource_type: str
    label: str
    latest_version: str
    version_count: int
    versions: List[ProjectResourceVersionRead]
