from typing import Optional, List
from datetime import datetime, timezone
from sqlmodel import SQLModel, Field
from sqlalchemy import Column, DateTime, JSON, func


class ShipmentBase(SQLModel):
    tracking_number: str = Field(index=True, unique=True)
    carrier: str
    status: str = "Unknown"
    lifecycle_state: Optional[str] = None
    origin: Optional[str] = None
    destination: Optional[str] = None
    recipient: Optional[str] = None
    exhibition_name: Optional[str] = None
    items: Optional[str] = None
    eta: Optional[str] = None
    progress: Optional[int] = Field(default=0)
    show_date: Optional[str] = None
    cs: Optional[str] = None
    no_of_box: Optional[str] = None
    booking_date: Optional[str] = None
    show_city: Optional[str] = None
    cs_type: Optional[str] = None
    remarks: Optional[str] = None
    last_scan_date: Optional[str] = None
    history: List[dict] = Field(default=[], sa_column=Column(JSON))
    master_tracking_number: Optional[str] = None
    project_id: Optional[int] = Field(default=None, foreign_key="dashboardproject.id")
    is_master: bool = Field(default=False)
    is_archived: bool = Field(default=False)
    awb: Optional[str] = Field(default=None, index=True)
    label_url: Optional[str] = None
    label_path: Optional[str] = None
    pickup_id: Optional[str] = None
    pickup_status: Optional[str] = None
    quote_amount: Optional[float] = None
    quote_currency: Optional[str] = None
    quoted_delivery_time: Optional[str] = None
    service_type: Optional[str] = None
    package_weight_kg: Optional[float] = None
    package_length_cm: Optional[float] = None
    package_width_cm: Optional[float] = None
    package_height_cm: Optional[float] = None
    booking_payload: dict = Field(default={}, sa_column=Column(JSON))
    # Stores [{"tracking_number": str, "status": str, "raw_status": str}, ...]
    child_parcels: List[dict] = Field(default=[], sa_column=Column(JSON))


class Shipment(ShipmentBase, table=True):
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
