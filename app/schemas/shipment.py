"""
Pydantic response schemas for Shipment endpoints.

These are separate from the SQLModel `Shipment` table model so that:
  1. API responses have clearly-typed shapes (not raw JSON columns).
  2. Breaking DB changes don't cascade into API consumers.
  3. We can expose derived / computed fields (e.g. child_tracking_numbers).
"""
from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator


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
    booking_date: Optional[str] = None
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
    lifecycle_state: Optional[str] = None
    origin: Optional[str] = None
    destination: Optional[str] = None
    recipient: Optional[str] = None
    exhibition_name: Optional[str] = None
    items: Optional[str] = None
    project_id: Optional[int] = None
    project_name: Optional[str] = None
    project_client_name: Optional[str] = None
    eta: Optional[str] = None
    booking_date: Optional[str] = None
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
    awb: Optional[str] = None
    label_url: Optional[str] = None
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


class ShipmentReceiverInput(BaseModel):
    company_name: Optional[str] = Field(default=None, max_length=120)
    name: str = Field(min_length=2, max_length=120)
    email: Optional[EmailStr] = None
    phone: str = Field(min_length=5, max_length=40)
    address_line1: str = Field(min_length=3, max_length=120)
    address_line2: Optional[str] = Field(default=None, max_length=120)
    address_line3: Optional[str] = Field(default=None, max_length=120)
    city: str = Field(min_length=2, max_length=80)
    state_code: Optional[str] = Field(default=None, max_length=40)
    postal_code: str = Field(min_length=2, max_length=20)
    country_code: str = Field(min_length=2, max_length=2)
    country_name: Optional[str] = Field(default=None, max_length=80)

    @field_validator("country_code")
    @classmethod
    def normalize_country_code(cls, value: str) -> str:
        return value.strip().upper()


class ShipmentPackageInput(BaseModel):
    pieces: int = Field(default=1, ge=1, le=999)
    weight_kg: float = Field(gt=0, le=9999)
    length_cm: float = Field(gt=0, le=999)
    width_cm: float = Field(gt=0, le=999)
    height_cm: float = Field(gt=0, le=999)
    declared_value: float = Field(default=0, ge=0, le=99999999)
    declared_currency: str = Field(default="USD", min_length=3, max_length=3)

    @field_validator("declared_currency")
    @classmethod
    def normalize_declared_currency(cls, value: str) -> str:
        return value.strip().upper()


class ShipmentBookingInput(BaseModel):
    description: str = Field(min_length=2, max_length=120)
    service_type: str = Field(default="P", min_length=1, max_length=10)
    local_product_code: Optional[str] = Field(default=None, max_length=20)
    terms_of_trade: Optional[str] = Field(default=None, max_length=20)
    shipping_payment_type: Optional[str] = Field(default=None, max_length=20)
    duty_payment_type: Optional[str] = Field(default=None, max_length=20)
    is_dutiable: bool = True
    shipper_reference: Optional[str] = Field(default=None, max_length=80)
    exhibition_name: Optional[str] = Field(default=None, max_length=120)
    show_date: Optional[str] = Field(default=None, max_length=40)
    project_id: Optional[int] = None


class ShipmentBookingRequest(BaseModel):
    receiver: ShipmentReceiverInput
    package: ShipmentPackageInput
    shipment: ShipmentBookingInput


class ShipmentRateResponse(BaseModel):
    status: str
    lifecycle_state: str
    price: float
    currency: str
    delivery_time: Optional[str] = None
    service_type: Optional[str] = None


class ShipmentCreateResponse(BaseModel):
    status: str
    lifecycle_state: str
    awb: str
    tracking_number: str
    label_url: str
    shipment_id: int


class PickupScheduleRequest(BaseModel):
    awb: str = Field(min_length=8, max_length=50)
    pickup_date: Optional[str] = Field(default=None, max_length=20)
    ready_by_time: Optional[str] = Field(default=None, max_length=5)
    closing_time: Optional[str] = Field(default=None, max_length=5)

    @field_validator("awb")
    @classmethod
    def normalize_awb(cls, value: str) -> str:
        return value.strip().upper()


class PickupScheduleResponse(BaseModel):
    status: str
    lifecycle_state: str
    awb: str
    pickup_id: str
    pickup_status: str
