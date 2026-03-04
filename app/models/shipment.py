from typing import Optional, List
from datetime import datetime, timezone
from sqlmodel import SQLModel, Field
from sqlalchemy import Column, DateTime, JSON, func


class ShipmentBase(SQLModel):
    tracking_number: str = Field(index=True, unique=True)
    carrier: str
    status: str = "Unknown"
    origin: Optional[str] = None
    destination: Optional[str] = None
    recipient: Optional[str] = None
    exhibition_name: Optional[str] = None
    items: Optional[str] = None
    eta: Optional[str] = None
    progress: Optional[int] = Field(default=0)
    show_date: Optional[str] = None
    history: List[dict] = Field(default=[], sa_column=Column(JSON))


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
