"""
Pydantic response schemas for Shipment endpoints.

These are separate from the SQLModel `Shipment` table model so that:
  1. API responses have clearly-typed shapes (not raw JSON columns).
  2. Breaking DB changes don't cascade into API consumers.
  3. We can expose derived / computed fields (e.g. child_tracking_numbers).
"""
from typing import List, Literal, Optional
from datetime import datetime
from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator


def _parse_json_maybe_list(value):
    if isinstance(value, str):
        import json

        try:
            value = json.loads(value)
        except Exception:
            value = []
    return value if value is not None else []


def normalize_child_parcel_dicts(value) -> list[dict]:
    """Turn stored JSON into a list of dicts safe for ChildParcel validation."""
    raw = _parse_json_maybe_list(value)
    if not isinstance(raw, list):
        return []

    normalized: list[dict] = []
    for item in raw:
        if isinstance(item, dict):
            row = dict(item)
            tn = row.get("tracking_number")
            if tn is None or (isinstance(tn, str) and not str(tn).strip()):
                row["tracking_number"] = "UNKNOWN"
            normalized.append(row)
        else:
            normalized.append({"tracking_number": "UNKNOWN", "status": str(item or "Unknown")})
    return normalized


class ChildParcel(BaseModel):
    """
    A single parcel within a Multi-Piece Shipment (MPS).

    FedEx returns these inside `associatedShipments` when the queried
    tracking number is the master of an MPS group.
    """

    model_config = {"extra": "ignore"}

    tracking_number: str = Field(default="UNKNOWN")
    status: str = "Unknown"
    raw_status: str = ""
    origin: Optional[str] = None
    destination: Optional[str] = None
    eta: Optional[str] = None
    booking_date: Optional[str] = None
    last_date: Optional[str] = None
    last_location: Optional[str] = None
    carrier: Optional[str] = None

    @field_validator("tracking_number", mode="before")
    @classmethod
    def ensure_tracking_number(cls, value):
        if value is None:
            return "UNKNOWN"
        token = str(value).strip()
        return token if token else "UNKNOWN"


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
    last_scan_date: Optional[str] = None
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

    @staticmethod
    def _parse_json_list(v):
        return _parse_json_maybe_list(v)

    @field_validator("tracking_number", mode="before")
    @classmethod
    def coerce_tracking_number(cls, value):
        if value is None:
            return "UNKNOWN"
        token = str(value).strip()
        return token if token else "UNKNOWN"

    @field_validator("carrier", mode="before")
    @classmethod
    def coerce_carrier(cls, value):
        if value is None:
            return "Unknown"
        token = str(value).strip()
        return token if token else "Unknown"

    @field_validator("status", mode="before")
    @classmethod
    def coerce_status(cls, value):
        if value is None:
            return "Unknown"
        token = str(value).strip()
        return token if token else "Unknown"

    @field_validator("progress", mode="before")
    @classmethod
    def coerce_progress(cls, value):
        if value is None:
            return 0
        if isinstance(value, bool):
            return int(value)
        try:
            return int(value)
        except (TypeError, ValueError):
            return 0

    @field_validator("history", mode="before")
    @classmethod
    def normalize_history(cls, v):
        """
        Neon/SQLite sometimes store a single object or non-list in JSON columns.
        Pydantic expects List[dict]; mismatches produced HTTP 500 on list endpoints.
        """
        raw = ShipmentResponse._parse_json_list(v)
        if isinstance(raw, dict):
            raw = [raw]
        if not isinstance(raw, list):
            return []
        out: List[dict] = []
        for item in raw:
            if isinstance(item, dict):
                out.append(item)
            elif item is not None:
                out.append({"description": str(item)})
        return out

    @field_validator("child_tracking_numbers", mode="before")
    @classmethod
    def normalize_child_tracking_numbers_flat(cls, v):
        raw = ShipmentResponse._parse_json_list(v)
        if not isinstance(raw, list):
            return []
        result: List[str] = []
        for x in raw:
            if x is None:
                continue
            token = str(x).strip()
            if token:
                result.append(token)
        return result

    @field_validator("child_parcels", mode="before")
    @classmethod
    def normalize_child_parcels(cls, v):
        """
        DB JSON may contain incomplete legacy rows (missing tracking_number).
        Those used to raise ValidationError and surface as HTTP 500 on list/detail routes.
        """
        return normalize_child_parcel_dicts(v)

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
        parcels = [ChildParcel.model_validate(row) for row in normalize_child_parcel_dicts(shipment.child_parcels)]
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
    shipment_type: Literal["NORMAL", "CSB_IV_CARGO", "CSB_V"] = "CSB_V"
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


class ShipmentCommercialInput(BaseModel):
    iec_no: Optional[str] = Field(default=None, max_length=20)
    gstin: Optional[str] = Field(default=None, max_length=20)
    bank_ad_code: Optional[str] = Field(default=None, max_length=20)
    invoice_number: Optional[str] = Field(default=None, max_length=40)
    invoice_date: Optional[str] = Field(default=None, max_length=20)
    use_dhl_invoice: str = Field(default="Y", max_length=1)
    using_ecommerce: str = Field(default="0", max_length=5)
    is_under_meis_scheme: str = Field(default="0", max_length=20)
    is_using_igst: str = Field(default="No", max_length=5)
    using_bond_or_ut: str = Field(default="Yes", max_length=5)
    manufacture_country_code: str = Field(default="IN", min_length=2, max_length=2)
    manufacture_country_name: str = Field(default="INDIA", max_length=80)
    hs_code: Optional[str] = Field(default=None, max_length=20)
    commodity_code: Optional[str] = Field(default=None, max_length=20)
    commodity_type: str = Field(default="Others", max_length=80)
    invoice_rate_per_unit: Optional[float] = Field(default=None, ge=0)
    quantity: int = Field(default=1, ge=1, le=999999)
    uom: str = Field(default="PCS", max_length=10)
    cess_amount: float = Field(default=0, ge=0)
    igst_amount: float = Field(default=0, ge=0)
    igst_percentage: Optional[float] = Field(default=None, ge=0, le=100)
    taxable_value: Optional[float] = Field(default=None, ge=0)
    special_service: str = Field(default="DS", max_length=80)
    place_of_supply: Optional[str] = Field(default=None, max_length=80)
    date_of_supply: Optional[str] = Field(default=None, max_length=20)
    shipper_state_code: Optional[str] = Field(default=None, max_length=20)
    shipper_state_name: Optional[str] = Field(default=None, max_length=80)

    @field_validator("manufacture_country_code")
    @classmethod
    def normalize_manufacture_country_code(cls, value: str) -> str:
        return value.strip().upper()

    @field_validator("use_dhl_invoice")
    @classmethod
    def normalize_use_dhl_invoice(cls, value: str) -> str:
        return value.strip().upper() or "Y"


class ShipmentBookingRequest(BaseModel):
    receiver: ShipmentReceiverInput
    package: ShipmentPackageInput
    shipment: ShipmentBookingInput
    commercial: Optional[ShipmentCommercialInput] = None


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
