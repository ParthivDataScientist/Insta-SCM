"""
Pydantic response schemas for Shipment endpoints.

These are separate from the SQLModel `Shipment` table model so that:
  1. API responses have clearly-typed shapes (not raw JSON columns).
  2. Breaking DB changes don't cascade into API consumers.
  3. We can expose derived / computed fields (e.g. child_tracking_numbers).
"""
from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel, model_validator, field_validator


class ChildParcel(BaseModel):
    """
    A single parcel within a Multi-Piece Shipment (MPS).

    FedEx returns these inside `associatedShipments` when the queried
    tracking number is the master of an MPS group.
    """
    tracking_number: str
    status: str = "Unknown"
    raw_status: str = ""
    origin: Optional[str] = None
    destination: Optional[str] = None
    eta: Optional[str] = None
    last_date: Optional[str] = None
    last_location: Optional[str] = None
    carrier: Optional[str] = None


class ShipmentResponse(BaseModel):
    """
    Full shipment record returned by the API.

    Uses `model_config` with `from_attributes=True` so FastAPI can build
    this directly from the SQLAlchemy/SQLModel ORM object.
    """
    model_config = {"from_attributes": True}

    id: int
    tracking_number: str
    carrier: str
    status: str
    origin: Optional[str] = None
    destination: Optional[str] = None
    recipient: Optional[str] = None
    exhibition_name: Optional[str] = None
    items: Optional[str] = None
    project_id: Optional[int] = None
    project_name: Optional[str] = None
    project_client_name: Optional[str] = None
    eta: Optional[str] = None
    progress: Optional[int] = 0
    show_date: Optional[str] = None
    cs: Optional[str] = None
    no_of_box: Optional[str] = None
    history: List[dict] = []
    created_at: datetime
    updated_at: datetime

    # MPS fields
    is_master: bool = False
    is_archived: bool = False
    master_tracking_number: Optional[str] = None
    # Rich child-parcel objects (preferred)
    child_parcels: List[ChildParcel] = []
    # Flat list of child tracking numbers (derived for backward compat)
    child_tracking_numbers: List[str] = []

    @field_validator("child_parcels", "child_tracking_numbers", "history", mode="before")
    @classmethod
    def default_to_empty_list(cls, v):
        return v if v is not None else []

    @model_validator(mode="after")
    def derive_child_tracking_numbers(self) -> "ShipmentResponse":
        """Ensure the flat list is always in sync with the rich objects."""
        if self.child_parcels and not self.child_tracking_numbers:
            self.child_tracking_numbers = [p.tracking_number for p in self.child_parcels]
        return self


class MPSDetailResponse(BaseModel):
    """
    Response for the GET /mps/{shipment_id} endpoint.
    Returns the master shipment plus enriched child parcel data.
    """
    model_config = {"from_attributes": True}

    master: ShipmentResponse
    child_parcels: List[ChildParcel]
    total_pieces: int
    pieces_delivered: int
    pieces_in_exception: int

    @classmethod
    def from_shipment(cls, shipment: "Shipment") -> "MPSDetailResponse":  # noqa: F821
        parcels = [ChildParcel(**p) for p in (shipment.child_parcels or [])]
        return cls(
            master=ShipmentResponse.model_validate(shipment),
            child_parcels=parcels,
            total_pieces=len(parcels),
            pieces_delivered=sum(1 for p in parcels if p.status == "Delivered"),
            pieces_in_exception=sum(1 for p in parcels if p.status == "Exception"),
        )
