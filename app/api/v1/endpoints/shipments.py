"""
Shipments API endpoints - HTTP layer only.
All business logic lives in app.services.shipment_service.
"""
import asyncio
import io
import logging
from typing import List, Optional

import pandas as pd
from fastapi import APIRouter, Depends, File, HTTPException, Path, Query, UploadFile
from fastapi.responses import StreamingResponse
from fastapi.concurrency import run_in_threadpool
from pydantic import AliasChoices, BaseModel, Field
from sqlmodel import Session, select

from app.api.middleware.dhl_validation import validate_dhl_awb_or_400
from app.core.security import verify_api_key
from app.db.session import get_session
from app.models.dashboard_project import DashboardProject
from app.models.shipment import Shipment
from app.schemas.shipment import (
    MPSDetailResponse,
    PickupScheduleRequest,
    PickupScheduleResponse,
    ShipmentBookingRequest,
    ShipmentCreateResponse,
    ShipmentRateResponse,
    ShipmentResponse,
)
from app.services.shipment_service import (
    create_shipment,
    get_stats,
    preview_track,
    rate_shipment,
    refresh_tracked_shipments,
    schedule_pickup,
    track_and_save,
    _fetch_shipment_live_status,
    save_shipment_to_db,
    _resolve_child_fallback_result,
)
from app.services.carrier_detection import detect_carrier
from app.services.dhl import DHLService

logger = logging.getLogger(__name__)
router = APIRouter()

MAX_EXCEL_FILE_SIZE = 5 * 1024 * 1024  # 5 MB


class TrackRequest(BaseModel):
    """Request body for tracking a new shipment."""
    recipient: Optional[str] = None
    shipment_name: Optional[str] = None
    destination: Optional[str] = None
    show_date: Optional[str] = None
    exhibition_name: Optional[str] = None
    cs: Optional[str] = None
    no_of_box: Optional[str] = None
    project_id: Optional[int] = None


class BatchRequest(BaseModel):
    """Request body for batch operations."""
    shipment_ids: List[int]
    archive: Optional[bool] = None


class RefreshRequest(BaseModel):
    """Request body for re-syncing saved shipment records."""
    shipment_ids: Optional[List[int]] = None
    include_children: bool = False

class SheetRow(BaseModel):
    model_config = {"populate_by_name": True}

    ship_to_location: Optional[str] = Field(
        default=None,
        validation_alias=AliasChoices("ship_to_location", "shipToLocation", "Ship to location"),
    )
    client_name: Optional[str] = Field(
        default=None,
        validation_alias=AliasChoices("client_name", "clientName", "Client Name"),
    )
    booking_date: Optional[str] = Field(
        default=None,
        validation_alias=AliasChoices("booking_date", "bookingDate", "booking_dt", "Booking Date", "Booking dt."),
    )
    show_date: Optional[str] = Field(
        default=None,
        validation_alias=AliasChoices("show_date", "showDate", "Show Date", "Show date", "show date"),
    )
    show_city: Optional[str] = Field(
        default=None,
        validation_alias=AliasChoices("show_city", "showCity", "Show City"),
    )
    cs_type: Optional[str] = Field(
        default=None,
        validation_alias=AliasChoices("cs_type", "csType", "C/S", "CS"),
    )
    no_of_box: Optional[str] = Field(
        default=None,
        validation_alias=AliasChoices("no_of_box", "noOfBox", "No of Box"),
    )
    courier: Optional[str] = Field(
        default=None,
        validation_alias=AliasChoices("courier", "Courier"),
    )
    master_awb: Optional[str] = Field(
        default=None,
        validation_alias=AliasChoices("master_awb", "masterAwb", "Master AWB"),
    )
    child_awb: Optional[str] = Field(
        default=None,
        validation_alias=AliasChoices(
            "child_awb",
            "childAwb",
            "childPackage",
            "child_package",
            "Child AWB",
            "Child AWB #",
            "Child AWB#",
            "Child Package",
            "Child Package #",
            "Child Package#",
            "Child Package AWB",
            "Package AWB",
            "Piece AWB",
            "Piece ID",
        ),
    )
    remarks: Optional[str] = Field(
        default=None,
        validation_alias=AliasChoices("remarks", "Remarks"),
    )
    country: Optional[str] = Field(
        default=None,
        validation_alias=AliasChoices("country", "Country"),
    )

class WebhookPayload(BaseModel):
    rows: List[SheetRow]


EMPTY_TRACKING_TOKENS = {"", "nan", "none", "null", "-", "n/a", "na"}
CHILD_TRACKING_COLUMN_KEYS = (
    "child_awb",
    "child_package",
    "child_package_awb",
    "package_awb",
    "piece_awb",
    "piece_id",
    "child_tracking",
    "child_tracking_number",
)


def _normalize_tracking_cell(value: Optional[str]) -> str:
    token = str(value or "").strip()
    if token.lower() in EMPTY_TRACKING_TOKENS:
        return ""
    if token.endswith(".0") and token[:-2].isdigit():
        token = token[:-2]
    return token.upper()


def _normalize_text_cell(value: Optional[str]) -> str:
    token = str(value or "").strip()
    return "" if token.lower() in EMPTY_TRACKING_TOKENS else token


def _normalize_import_column(column_name: str) -> str:
    token = str(column_name or "").strip().lower()
    for old, new in (("/", "_"), ("#", ""), (".", ""), (" ", "_")):
        token = token.replace(old, new)
    while "__" in token:
        token = token.replace("__", "_")
    return token.strip("_")


def _first_present_row_value(row, *keys: str) -> Optional[str]:
    for key in keys:
        value = row.get(key)
        if value is None or pd.isna(value):
            continue
        token = _normalize_text_cell(value)
        if token:
            return token
    return None


def _first_present_tracking_value(row, *keys: str) -> Optional[str]:
    for key in keys:
        value = row.get(key)
        if value is None or pd.isna(value):
            continue
        token = _normalize_tracking_cell(value)
        if token:
            return token
    return None


def _resolve_tracking_row(
    *,
    master_awb: Optional[str],
    child_awb: Optional[str],
    legacy_tracking: Optional[str] = None,
    last_master_awb: Optional[str] = None,
    current_client_name: Optional[str] = None,
    last_master_client_name: Optional[str] = None,
) -> tuple[Optional[str], Optional[str], bool, Optional[str], Optional[str]]:
    """
    Resolve the row tracking number and MPS relationship.

    Vertical sheet rules:
    - a master-only row starts a new active master group;
    - a child-only row belongs to the active master above it;
    - a row with both columns tracks the child under that row's master.

    Returns:
        (
            tracking_number,
            master_tracking_number,
            is_master,
            next_last_master_awb,
            next_last_master_client_name,
        )
    """
    master = _normalize_tracking_cell(master_awb)
    child = _normalize_tracking_cell(child_awb)
    legacy = _normalize_tracking_cell(legacy_tracking)
    last_master = _normalize_tracking_cell(last_master_awb)

    if master and child:
        if master == child:
            return master, None, True, master, _normalize_text_cell(current_client_name)
        # Google Sheet flow can provide both columns for child rows:
        # master_awb is the parent, child_awb is the parcel being tracked.
        next_master_client = last_master_client_name if master == last_master else _normalize_text_cell(current_client_name)
        return child, master, False, master, next_master_client

    if master:
        return master, None, True, master, _normalize_text_cell(current_client_name)

    if child:
        return child, last_master, False, last_master, last_master_client_name

    if legacy:
        return legacy, None, False, last_master, last_master_client_name

    return None, None, False, last_master, last_master_client_name


def _save_sheet_row_without_live_tracking(
    *,
    db: Session,
    tracking_number: str,
    recipient: Optional[str] = None,
    items: Optional[str] = None,
    show_date: Optional[str] = None,
    exhibition_name: Optional[str] = None,
    cs: Optional[str] = None,
    no_of_box: Optional[str] = None,
    project_id: Optional[int] = None,
    booking_date: Optional[str] = None,
    show_city: Optional[str] = None,
    cs_type: Optional[str] = None,
    remarks: Optional[str] = None,
    destination: Optional[str] = None,
    master_tracking_number: Optional[str] = None,
    is_master: Optional[bool] = None,
    country: Optional[str] = None,
    commit: bool = True,
) -> Optional[dict]:
    """
    Keep spreadsheet imports complete even when live tracking is unsupported.

    UPS tracking is intentionally not wired to a carrier provider yet, but
    Google Sheet rows still need to appear on the shipping page.
    """
    tracking_number = _normalize_tracking_cell(tracking_number)
    carrier = detect_carrier(tracking_number)
    if carrier != "UPS":
        return None

    shipment = db.exec(select(Shipment).where(Shipment.tracking_number == tracking_number)).first()
    if not shipment:
        shipment = Shipment(
            tracking_number=tracking_number,
            carrier=carrier,
            status="Tracking Unavailable",
            lifecycle_state="TRACKING_UNAVAILABLE",
            recipient=recipient or "",
            exhibition_name=exhibition_name,
            items=items or "Package",
            show_date=show_date,
            cs=cs,
            no_of_box=no_of_box,
            project_id=project_id,
            booking_date=booking_date,
            show_city=show_city,
            cs_type=cs_type,
            remarks=remarks,
            destination=(destination or "").strip() or "Unknown",
            origin="Unknown",
            eta="TBD",
            progress=0,
            history=[],
            master_tracking_number=master_tracking_number,
            is_master=bool(is_master),
            child_parcels=[],
            country=country,
        )
    else:
        shipment.carrier = carrier
        shipment.status = shipment.status or "Tracking Unavailable"
        shipment.lifecycle_state = shipment.lifecycle_state or "TRACKING_UNAVAILABLE"
        if recipient:
            shipment.recipient = recipient
        if items:
            shipment.items = items
        if show_date:
            shipment.show_date = show_date
        if exhibition_name and exhibition_name != "Unknown Exhibition":
            shipment.exhibition_name = exhibition_name
        if cs:
            shipment.cs = cs
        if no_of_box is not None:
            shipment.no_of_box = no_of_box
        if project_id is not None:
            shipment.project_id = project_id
        if booking_date is not None:
            shipment.booking_date = booking_date
        if show_city is not None:
            shipment.show_city = show_city
        if cs_type is not None:
            shipment.cs_type = cs_type
        if remarks is not None:
            shipment.remarks = remarks
        if destination:
            shipment.destination = destination
        if master_tracking_number is not None:
            shipment.master_tracking_number = master_tracking_number
        if is_master is not None:
            shipment.is_master = is_master
        if country is not None:
            shipment.country = country

    db.add(shipment)
    if commit:
        db.commit()
        db.refresh(shipment)
    return {"tracking_number": tracking_number, "status": "saved_without_live_tracking", "carrier": carrier}


def _serialize_shipment(db: Session, shipment: Shipment) -> ShipmentResponse:
    project = db.get(DashboardProject, shipment.project_id) if shipment.project_id else None
    payload = ShipmentResponse.model_validate(shipment).model_dump()
    payload["project_name"] = project.project_name if project else None
    payload["project_client_name"] = (
        project.client_relationship.name
        if project and project.client_relationship
        else None
    )
    return ShipmentResponse(**payload)


def _validate_project_reference(db: Session, project_id: Optional[int]) -> Optional[DashboardProject]:
    if project_id is None:
        return None

    project = db.get(DashboardProject, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Linked project not found")
    return project


# ---------------------------------------------------------------------------
# ENDPOINTS
# ---------------------------------------------------------------------------




@router.get("/track/{tracking_number}/preview")
async def preview_shipment(
    tracking_number: str = Path(
        ...,
        min_length=8,
        max_length=50,
        description="Carrier tracking number to preview (no DB save)",
    ),
    master_tracking_number: Optional[str] = Query(
        default=None,
        description="Optional master tracking number hint for child-piece lookups.",
    ),
    db: Session = Depends(get_session),
    _key: str = Depends(verify_api_key),
):
    """Fetch live tracking data for a tracking number WITHOUT saving to the database."""
    result = await preview_track(
        tracking_number.upper(),
        db=db,
        master_tracking_number=(master_tracking_number or "").upper() or None,
    )
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


@router.get("/dhl/track/{awb}/preview")
async def preview_dhl_shipment(
    awb: str = Path(
        ...,
        min_length=10,
        max_length=20,
        description="DHL Express India AWB (10 digits)",
    ),
    _key: str = Depends(verify_api_key),
):
    """
    DHL-only preview endpoint with strict AWB validation and isolated DHL provider flow.
    """
    normalized_awb = validate_dhl_awb_or_400(awb)
    result = await DHLService().track(normalized_awb)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return {
        "carrier": "DHL",
        "tracking_number": normalized_awb,
        "current_status": result.get("current_status"),
        "estimated_delivery": result.get("estimated_delivery"),
        "last_location": result.get("last_location"),
    }


@router.post("/rate", response_model=ShipmentRateResponse, status_code=200)
def rate_dhl_shipment(
    body: ShipmentBookingRequest,
    db: Session = Depends(get_session),
    _key: str = Depends(verify_api_key),
):
    if body.shipment.project_id is not None:
        _validate_project_reference(db, body.shipment.project_id)

    result = rate_shipment(body.model_dump(mode="json"))
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


@router.post("/create", response_model=ShipmentCreateResponse, status_code=201)
def create_dhl_shipment(
    body: ShipmentBookingRequest,
    db: Session = Depends(get_session),
    _key: str = Depends(verify_api_key),
):
    if body.shipment.project_id is not None:
        _validate_project_reference(db, body.shipment.project_id)

    result = create_shipment(body.model_dump(mode="json"), db)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


@router.post("/pickup", response_model=PickupScheduleResponse, status_code=200)
def schedule_dhl_pickup(
    body: PickupScheduleRequest,
    db: Session = Depends(get_session),
    _key: str = Depends(verify_api_key),
):
    result = schedule_pickup(
        body.awb,
        db,
        pickup_date=body.pickup_date,
        ready_by_time=body.ready_by_time,
        closing_time=body.closing_time,
    )
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


@router.post("/track/{tracking_number}", status_code=201)
async def track_shipment(
    tracking_number: str = Path(
        ...,
        min_length=8,
        max_length=50,
        pattern=r"^[A-Z0-9]+$",
        description="Carrier tracking number (uppercase alphanumeric, 8-50 chars)",
    ),
    body: TrackRequest = ...,
    db: Session = Depends(get_session),
    _key: str = Depends(verify_api_key),
):
    """Track a shipment via carrier API and save/update in DB."""
    if body.project_id is not None:
        _validate_project_reference(db, body.project_id)
    result = await track_and_save(
        tracking_number=tracking_number.upper(),
        recipient=body.recipient,
        items=body.shipment_name,
        destination=body.destination,
        show_date=body.show_date,
        exhibition_name=body.exhibition_name or "Unknown Exhibition",
        db=db,
        cs=body.cs,
        no_of_box=body.no_of_box,
        project_id=body.project_id,
    )
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


# ---------------------------------------------------------------------------
# Batch import from Excel - uses BackgroundTasks so the response is immediate
# ---------------------------------------------------------------------------

async def _process_excel_import(contents: bytes, db: Session):
    """Parse Excel rows and track each shipment, supporting Master/Child vertical nesting logic."""
    df = pd.read_excel(io.BytesIO(contents))
    # Normalize column names for easier lookup
    df.columns = [_normalize_import_column(c) for c in df.columns]

    # Required columns check (allowing for either tracking_number OR master/child structure)
    has_legacy = "tracking_number" in df.columns
    has_mps = "master_awb" in df.columns or any(key in df.columns for key in CHILD_TRACKING_COLUMN_KEYS)
    
    if not has_legacy and not has_mps:
        logger.error("Excel import: missing tracking columns (tracking_number or master_awb/child_awb)")
        return {"error": "Missing required tracking columns. Ensure 'Master AWB' or 'Tracking Number' exists.", "success": 0, "failed": 0}

    # Phase 1: Collect metadata and run concurrent network lookups without DB session
    tasks = []
    row_metadata = []
    
    last_master_awb = None
    last_master_client_name = None
    
    # Fetch valid project IDs upfront to eliminate database query leaks inside the loop
    valid_project_ids = set()
    if "project_id" in df.columns:
        project_ids_in_sheet = set()
        for val in df["project_id"]:
            if pd.notna(val):
                try:
                    project_ids_in_sheet.add(int(val))
                except (ValueError, TypeError):
                    pass
        if project_ids_in_sheet:
            valid_project_ids = set(
                db.exec(
                    select(DashboardProject.id).where(DashboardProject.id.in_(list(project_ids_in_sheet)))
                ).all()
            )

    for _, row in df.iterrows():
        row_client_name = _first_present_row_value(row, "client_name", "recipient")
        tracking_num, master_to_use, is_master, last_master_awb, last_master_client_name = _resolve_tracking_row(
            master_awb=row.get("master_awb"),
            child_awb=_first_present_tracking_value(row, *CHILD_TRACKING_COLUMN_KEYS),
            legacy_tracking=row.get("tracking_number"),
            last_master_awb=last_master_awb,
            current_client_name=row_client_name,
            last_master_client_name=last_master_client_name,
        )
        if not tracking_num:
            continue

        # Metadata extraction
        items_name = _first_present_row_value(row, "name", "items")
        recipient = row_client_name or items_name
        show_date = _first_present_row_value(row, "show_date")
        
        exhibition_name = _first_present_row_value(row, "exhibition_name", "show_city") or "Unknown Exhibition"
        cs = _first_present_row_value(row, "cs", "cs_type")
        no_of_box = _first_present_row_value(row, "no_of_box", "boxes")
        destination_hint = _first_present_row_value(row, "ship_to_location", "destination")
        
        project_id = int(row["project_id"]) if "project_id" in df.columns and pd.notna(row.get("project_id")) else None

        if project_id is not None and project_id not in valid_project_ids:
            row_info = {
                "tracking_number": tracking_num.upper(),
                "project_error": f"{tracking_num.upper()}: linked project not found",
            }
            row_metadata.append(row_info)
            async def dummy_project_error():
                return {"error": "Project not found"}
            tasks.append(dummy_project_error())
            continue

        carrier_name = detect_carrier(tracking_num)
        row_info = {
            "tracking_number": tracking_num.upper(),
            "carrier_name": carrier_name,
            "recipient": recipient,
            "items": items_name,
            "show_date": show_date,
            "exhibition_name": exhibition_name,
            "cs": cs,
            "no_of_box": no_of_box,
            "project_id": project_id,
            "destination": destination_hint,
            "master_to_use": master_to_use,
            "is_master": is_master,
            "remarks": _first_present_row_value(row, "remarks"),
            "booking_date": _first_present_row_value(row, "booking_dt", "booking_date"),
            "country": _first_present_row_value(row, "country"),
        }
        row_metadata.append(row_info)

        if carrier_name in ("DHL", "FedEx"):
            tasks.append(
                _fetch_shipment_live_status(
                    tracking_number=tracking_num,
                    master_tracking_number=master_to_use,
                )
            )
        else:
            async def dummy_fetch():
                return {"error": "Skipped live tracking"}
            tasks.append(dummy_fetch())

    # Concurrently gather all live network requests
    results = await asyncio.gather(*tasks, return_exceptions=True)

    # Phase 2: Sequential DB Write
    success = 0
    failed = 0
    errors = []

    for row_info, result in zip(row_metadata, results):
        tracking_number = row_info["tracking_number"]
        if "project_error" in row_info:
            failed += 1
            errors.append(row_info["project_error"])
            continue

        if isinstance(result, Exception) or "error" in result:
            carrier_name = row_info["carrier_name"]
            fallback_res = None
            if carrier_name in ("DHL", "FedEx", "UPS", "Unknown"):
                fallback_res = _resolve_child_fallback_result(
                    db=db,
                    tracking_number=tracking_number,
                    master_tracking_number=row_info["master_to_use"],
                    allow_master_context=(carrier_name == "DHL"),
                )
            if fallback_res:
                result = fallback_res
            else:
                fallback_res = _save_sheet_row_without_live_tracking(
                    db=db,
                    tracking_number=tracking_number,
                    recipient=row_info["recipient"],
                    items=row_info["items"],
                    show_date=row_info["show_date"],
                    exhibition_name=row_info["exhibition_name"],
                    cs=row_info["cs"],
                    no_of_box=row_info["no_of_box"],
                    project_id=row_info["project_id"],
                    destination=row_info["destination"],
                    booking_date=row_info["booking_date"],
                    show_city=row_info["show_city"],
                    cs_type=row_info["cs_type"],
                    remarks=row_info["remarks"],
                    master_tracking_number=row_info["master_to_use"],
                    is_master=row_info["is_master"],
                    country=row_info.get("country"),
                    commit=False,
                )
                if fallback_res:
                    logger.info("Imported %s without live tracking provider (%s)", tracking_number, fallback_res["carrier"])
                    success += 1
                else:
                    err_msg = str(result) if isinstance(result, Exception) else result.get("error", "Unknown error")
                    logger.warning("Import failed for %s: %s", tracking_number, err_msg)
                    failed += 1
                    errors.append(f"{tracking_number}: {err_msg}")
                continue

        # Save the resolved result using save_shipment_to_db sequentially with commit=False
        try:
            save_shipment_to_db(
                db=db,
                tracking_number=tracking_number,
                result=result,
                recipient=row_info["recipient"],
                items=row_info["items"],
                show_date=row_info["show_date"],
                exhibition_name=row_info["exhibition_name"],
                cs=row_info["cs"],
                no_of_box=row_info["no_of_box"],
                project_id=row_info["project_id"],
                booking_date=row_info["booking_date"],
                show_city=row_info["show_city"],
                cs_type=row_info["cs_type"],
                remarks=row_info["remarks"],
                master_tracking_number=row_info["master_to_use"],
                is_master=row_info["is_master"],
                destination=row_info["destination"],
                country=row_info.get("country"),
                commit=False,
            )
            success += 1
        except Exception as e:
            failed += 1
            errors.append(f"{tracking_number}: {str(e)}")

    # Single final commit
    if success > 0:
        try:
            db.commit()
        except Exception as e:
            db.rollback()
            logger.error(f"Failed to commit batch Excel import: {str(e)}")
            raise e

    logger.info("Excel import complete: %d succeeded, %d failed", success, failed)
    return {"success": success, "failed": failed, "errors": errors}


@router.post("/import-excel", status_code=200)
async def import_excel(
    file: UploadFile = File(...),
    db: Session = Depends(get_session),
    _key: str = Depends(verify_api_key),
):
    """
    Import shipments from an Excel file (.xlsx/.xls).
    Expected columns: tracking_number, name (optional), show_date (optional)
    """
    if not (file.filename or "").lower().endswith((".xlsx", ".xls")):
        raise HTTPException(status_code=400, detail="Invalid file format. Upload an .xlsx or .xls file.")

    contents = await file.read(MAX_EXCEL_FILE_SIZE + 1)
    if len(contents) > MAX_EXCEL_FILE_SIZE:
        raise HTTPException(status_code=413, detail="File too large. Maximum allowed size is 5 MB.")

    result = await _process_excel_import(contents, db)
    
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
        
    return {
        "status": "completed",
        "success": result["success"],
        "failed": result["failed"],
        "errors": result["errors"],
        "message": f"Successfully imported {result['success']} shipments. {result['failed']} failed.",
    }


async def _process_webhook_payload(payload: WebhookPayload, db: Session):
    # Phase 1: Collect metadata and run concurrent network lookups without DB session
    tasks = []
    row_metadata = []
    
    last_master_awb = None
    last_master_client_name = None
    
    for row in payload.rows:
        tracking_number, master_to_use, is_master, last_master_awb, last_master_client_name = _resolve_tracking_row(
            master_awb=row.master_awb,
            child_awb=row.child_awb,
            last_master_awb=last_master_awb,
            current_client_name=row.client_name,
            last_master_client_name=last_master_client_name,
        )
        if not tracking_number:
            continue

        carrier_name = detect_carrier(tracking_number)
        row_info = {
            "tracking_number": tracking_number,
            "carrier_name": carrier_name,
            "recipient": row.client_name,
            "items": None,
            "show_date": row.show_date,
            "exhibition_name": "Unknown Exhibition",
            "cs": row.cs_type,
            "no_of_box": row.no_of_box,
            "project_id": None,
            "destination": row.ship_to_location,
            "booking_date": row.booking_date,
            "show_city": row.show_city,
            "cs_type": row.cs_type,
            "remarks": row.remarks,
            "master_to_use": master_to_use,
            "is_master": is_master,
            "country": row.country,
        }
        row_metadata.append(row_info)

        if carrier_name in ("DHL", "FedEx"):
            tasks.append(
                _fetch_shipment_live_status(
                    tracking_number=tracking_number,
                    master_tracking_number=master_to_use,
                )
            )
        else:
            async def dummy_fetch():
                return {"error": "Skipped live tracking"}
            tasks.append(dummy_fetch())

    # Concurrently gather all live network requests
    results = await asyncio.gather(*tasks, return_exceptions=True)

    # Phase 2: Sequential DB Write
    success = 0
    failed = 0
    errors = []

    for row_info, result in zip(row_metadata, results):
        tracking_number = row_info["tracking_number"]

        if isinstance(result, Exception) or "error" in result:
            carrier_name = row_info["carrier_name"]
            fallback_res = None
            if carrier_name in ("DHL", "FedEx", "UPS", "Unknown"):
                fallback_res = _resolve_child_fallback_result(
                    db=db,
                    tracking_number=tracking_number,
                    master_tracking_number=row_info["master_to_use"],
                    allow_master_context=(carrier_name == "DHL"),
                )
            if fallback_res:
                result = fallback_res
            else:
                fallback_res = _save_sheet_row_without_live_tracking(
                    db=db,
                    tracking_number=tracking_number,
                    recipient=row_info["recipient"],
                    items=row_info["items"],
                    show_date=row_info["show_date"],
                    exhibition_name=row_info["exhibition_name"],
                    cs=row_info["cs"],
                    no_of_box=row_info["no_of_box"],
                    project_id=row_info["project_id"],
                    destination=row_info["destination"],
                    booking_date=row_info["booking_date"],
                    show_city=row_info["show_city"],
                    cs_type=row_info["cs_type"],
                    remarks=row_info["remarks"],
                    master_tracking_number=row_info["master_to_use"],
                    is_master=row_info["is_master"],
                    country=row_info.get("country"),
                    commit=False,
                )
                if fallback_res:
                    success += 1
                else:
                    err_msg = str(result) if isinstance(result, Exception) else result.get("error", "Unknown error")
                    failed += 1
                    errors.append(f"{tracking_number}: {err_msg}")
                continue

        # Save the resolved result using save_shipment_to_db sequentially with commit=False
        try:
            save_shipment_to_db(
                db=db,
                tracking_number=tracking_number,
                result=result,
                recipient=row_info["recipient"],
                items=row_info["items"],
                show_date=row_info["show_date"],
                exhibition_name=row_info["exhibition_name"],
                cs=row_info["cs"],
                no_of_box=row_info["no_of_box"],
                project_id=row_info["project_id"],
                booking_date=row_info["booking_date"],
                show_city=row_info["show_city"],
                cs_type=row_info["cs_type"],
                remarks=row_info["remarks"],
                master_tracking_number=row_info["master_to_use"],
                is_master=row_info["is_master"],
                destination=row_info["destination"],
                country=row_info.get("country"),
                commit=False,
            )
            success += 1
        except Exception as e:
            failed += 1
            errors.append(f"{tracking_number}: {str(e)}")

    # Single final commit
    if success > 0:
        try:
            db.commit()
        except Exception as e:
            db.rollback()
            logger.error(f"Failed to commit batch webhook payload: {str(e)}")
            raise e

    return {"success": success, "failed": failed, "errors": errors}


@router.post("/webhook/google-sheet", status_code=200)
async def google_sheet_webhook(
    payload: WebhookPayload,
    db: Session = Depends(get_session),
    # Optional API key for Google Apps Script to authenticate
    _key: str = Depends(verify_api_key),
):
    """
    Webhook to receive batch imports from Google Sheet.
    Implements Vertical Logic for Master/Child AWBs.
    """
    result = await _process_webhook_payload(payload, db)
    return {
        "status": "completed",
        "success": result["success"],
        "failed": result["failed"],
        "errors": result["errors"],
        "message": f"Processed {result['success']} shipments. {result['failed']} failed.",
    }


@router.get("/export-excel")
def export_shipments(
    shipment_ids: Optional[str] = Query(
        default=None,
        description="Comma-separated shipment IDs to export. If omitted, exports all active shipments.",
    ),
    db: Session = Depends(get_session),
    _key: str = Depends(verify_api_key),
):
    """Export shipments to Excel with requested formatting."""
    from openpyxl.styles import PatternFill, Font, Alignment, Border, Side
    from datetime import date, datetime, timedelta

    requested_ids: list[int] = []
    if shipment_ids:
        for token in shipment_ids.split(","):
            part = token.strip()
            if not part:
                continue
            if not part.isdigit():
                raise HTTPException(status_code=400, detail=f"Invalid shipment id: {part}")
            requested_ids.append(int(part))
        if not requested_ids:
            raise HTTPException(status_code=400, detail="No valid shipment ids provided for export")

    # Fetch non-archived shipments; optionally scoped to requested ids.
    statement = select(Shipment).where(Shipment.is_archived == False)
    if requested_ids:
        statement = statement.where(Shipment.id.in_(requested_ids))
    shipments = db.exec(statement).all()
    if requested_ids:
        order = {sid: idx for idx, sid in enumerate(requested_ids)}
        shipments.sort(key=lambda s: order.get(s.id or 0, len(order)))
    
    # Create Workbook
    from openpyxl import Workbook
    wb = Workbook()
    
    ws_transit = wb.active
    ws_transit.title = "In Transit"
    ws_delivered = wb.create_sheet(title="Delivered")

    today_str = datetime.now().strftime("%d.%m.%Y")
    
    headers = [
        "Ship to location", "Client Name", "Booking dt.", "Show date", 
        "Show City", "C/S", "No of Box", "Courier", "Master AWB", 
        "Child AWB #", "Current Status", "Remarks", "Last Scan date / Same place"
    ]
    
    # Styles
    header_font = Font(bold=True)
    header_fill = PatternFill(start_color="D9D9D9", end_color="D9D9D9", fill_type="solid")
    yellow_fill = PatternFill(start_color="FFFF00", end_color="FFFF00", fill_type="solid")
    alignment_center = Alignment(horizontal="center", vertical="center")
    border = Border(left=Side(style='thin'), right=Side(style='thin'), top=Side(style='thin'), bottom=Side(style='thin'))

    def _safe_date(raw_value):
        if not raw_value:
            return ""
        try:
            dt = datetime.fromisoformat(str(raw_value).replace("Z", "+00:00"))
            return dt.strftime("%d.%m.%Y")
        except (ValueError, TypeError):
            return str(raw_value)[:10]

    def _safe_time(raw_value):
        if not raw_value:
            return ""
        token = str(raw_value).strip()
        if ":" not in token and "T" not in token:
            return ""
        try:
            dt = datetime.fromisoformat(token.replace("Z", "+00:00"))
            return dt.strftime("%I:%M %p")
        except (ValueError, TypeError):
            try:
                parsed = pd.to_datetime(token, errors="coerce", dayfirst=True)
                if pd.isna(parsed):
                    return ""
                return parsed.strftime("%I:%M %p")
            except Exception:
                return ""

    def _format_booking_date(raw_value):
        formatted = _safe_date(raw_value)
        return formatted if formatted else ""

    def _format_event_date(raw_dt):
        if not raw_dt:
            return ""
        token = str(raw_dt).strip()
        has_time = ":" in token or "T" in token
        try:
            dt = pd.to_datetime(token)
            if pd.isna(dt):
                return token
            month = dt.strftime("%b")
            day = dt.day
            year = dt.year
            if has_time:
                time_part = dt.strftime("%I:%M %p")
                if time_part.startswith("0"):
                    time_part = time_part[1:]
                return f"{month} {day}, {year} • {time_part}"
            else:
                return f"{month} {day}, {year}"
        except Exception:
            return token

    def _format_current_status_card(date_raw, status_raw, location_raw, description_raw):
        date_line = _format_event_date(date_raw)
        status_line = str(status_raw or "").strip()
        location_line = str(location_raw or "").strip()
        description_line = str(description_raw or "").strip()

        lines = []
        if date_line:
            lines.append(date_line)
        if status_line:
            lines.append(status_line)
        if location_line:
            lines.append(location_line)
        if description_line and description_line != status_line:
            lines.append(description_line)

        return "\n".join(lines) if lines else "-"

    def _build_master_latest(shipment: Shipment):
        if shipment.history:
            latest = shipment.history[0]
            card = _format_current_status_card(
                latest.get("date"),
                latest.get("status"),
                latest.get("location"),
                latest.get("description")
            )
            return card, _safe_date(latest.get("date"))
        card = _format_current_status_card(
            shipment.last_scan_date,
            shipment.status,
            shipment.destination or shipment.origin,
            ""
        )
        return card, _safe_date(shipment.last_scan_date)

    def _build_child_latest(parent: Shipment, child: dict):
        c_date_raw = child.get("last_date")
        c_loc = child.get("last_location") or ""
        c_status = child.get("status") or "In Transit"
        c_desc = child.get("raw_status") or ""

        # Check if there is history in child dict
        history_list = child.get("history")
        if history_list and isinstance(history_list, list):
            latest = history_list[0]
            card = _format_current_status_card(
                latest.get("date"),
                latest.get("status"),
                latest.get("location"),
                latest.get("description")
            )
            return card, _safe_date(latest.get("date"))

        # Fallback to parent details if child date is missing
        if (not c_loc or not c_date_raw) and parent.history:
            master_latest = parent.history[0]
            if not c_loc:
                c_loc = master_latest.get("location", c_loc)
            if not c_date_raw:
                c_date_raw = master_latest.get("date")
                if not c_desc:
                    c_status = master_latest.get("status", c_status)
                    c_desc = master_latest.get("description", c_desc)

        card = _format_current_status_card(
            c_date_raw,
            c_status,
            c_loc,
            c_desc
        )
        return card, _safe_date(c_date_raw)

    def _build_child_latest_from_shipment(parent: Shipment, child: Shipment):
        c_date_raw = child.last_scan_date
        c_loc = child.destination or child.origin or ""
        c_status = child.status or "In Transit"
        c_desc = ""

        if child.history:
            latest = child.history[0]
            card = _format_current_status_card(
                latest.get("date"),
                latest.get("status"),
                latest.get("location"),
                latest.get("description")
            )
            return card, _safe_date(latest.get("date"))

        # Fallback to parent details if child date is missing
        if (not c_date_raw or c_date_raw == "-") and parent and parent.history:
            master_latest = parent.history[0]
            c_loc = master_latest.get("location", c_loc)
            c_date_raw = master_latest.get("date")
            c_status = master_latest.get("status", c_status)
            c_desc = master_latest.get("description", c_desc)

        card = _format_current_status_card(
            c_date_raw,
            c_status,
            c_loc,
            c_desc
        )
        return card, _safe_date(c_date_raw)

    def _parse_show_date(raw_value) -> Optional[date]:
        if raw_value is None:
            return None
        if isinstance(raw_value, datetime):
            return raw_value.date()
        if isinstance(raw_value, date):
            return raw_value

        token = str(raw_value).strip()
        if not token or token.lower() in EMPTY_TRACKING_TOKENS:
            return None

        parsed = pd.to_datetime(token, errors="coerce")
        if pd.isna(parsed):
            parsed = pd.to_datetime(token, errors="coerce", dayfirst=True)
        if pd.isna(parsed):
            return None
        return parsed.date()

    def _should_highlight_show_date(raw_value) -> bool:
        parsed = _parse_show_date(raw_value)
        if not parsed:
            return False
        today = date.today()
        window_end = today + timedelta(days=20)
        return today <= parsed <= window_end

    # Group records by linkage: rows with master_tracking_number are children.
    children_by_master = {}
    top_level_shipments = []
    for shipment in shipments:
        tn = (shipment.tracking_number or "").strip().upper()
        master_tn = (shipment.master_tracking_number or "").strip().upper()
        if master_tn and master_tn != tn:
            children_by_master.setdefault(master_tn, []).append(shipment)
        else:
            top_level_shipments.append(shipment)

    dash = "-"

    def _populate_sheet(ws, top_level_list, children_dict):
        # Write headers
        for col, header in enumerate(headers, 1):
            cell = ws.cell(row=1, column=col, value=header)
            cell.font = header_font
            cell.fill = header_fill
            cell.border = border
            cell.alignment = alignment_center

        def _write_row(row_idx: int, values: list, bold_master_awb: bool = False):
            for col, val in enumerate(values, 1):
                cell = ws.cell(row=row_idx, column=col, value=val)
                cell.border = border
                if headers[col - 1] == "Show date" and _should_highlight_show_date(val):
                    cell.fill = yellow_fill
                if col in [3, 8]:
                    cell.alignment = alignment_center
                elif col == 11:
                    cell.alignment = Alignment(wrap_text=True, vertical="top")
                if bold_master_awb and col == 9:
                    cell.font = Font(bold=True)

        current_row = 2
        rendered_master_tns = set()

        for s in top_level_list:
            master_tn = (s.tracking_number or "").strip().upper()
            if master_tn:
                rendered_master_tns.add(master_tn)

            latest_status, h_date = _build_master_latest(s)
            row_data = [
                s.destination or dash,
                s.recipient or dash,
                _format_booking_date(s.booking_date) or dash,
                s.show_date or dash,
                s.show_city or s.exhibition_name or dash,
                s.cs_type or s.cs or dash,
                s.no_of_box or dash,
                s.carrier.upper() if s.carrier else dash,
                s.tracking_number,
                "",  # Child AWB is empty on master row
                latest_status,
                s.remarks or dash,
                h_date or dash,
            ]
            _write_row(current_row, row_data, bold_master_awb=True)
            current_row += 1

            rendered_child_tns = set()

            # Render child records saved as individual Shipment rows.
            for child in children_dict.get(master_tn, []):
                child_status, child_date = _build_child_latest_from_shipment(s, child)
                child_tn = (child.tracking_number or "").strip().upper()
                if child_tn:
                    rendered_child_tns.add(child_tn)

                child_data = [
                    child.destination or s.destination or dash,
                    child.recipient or s.recipient or dash,
                    _format_booking_date(child.booking_date) or _format_booking_date(s.booking_date) or dash,
                    child.show_date or s.show_date or dash,
                    child.show_city or child.exhibition_name or s.show_city or s.exhibition_name or dash,
                    child.cs_type or child.cs or s.cs_type or s.cs or dash,
                    "",  # No of Box empty for child rows in export format
                    child.carrier.upper() if child.carrier else (s.carrier.upper() if s.carrier else dash),
                    "",  # Master AWB empty for child row
                    child.tracking_number or dash,
                    child_status,
                    child.remarks or s.remarks or dash,
                    child_date or dash,
                ]
                _write_row(current_row, child_data)
                current_row += 1

            # Render legacy JSON child parcels, skipping duplicates already rendered.
            for c in s.child_parcels or []:
                c_tn = str(c.get("tracking_number") or "").strip().upper()
                if c_tn and c_tn in rendered_child_tns:
                    continue
                c_latest, c_date = _build_child_latest(s, c)
                child_data = [
                    s.destination or dash,
                    s.recipient or dash,
                    _format_booking_date(s.booking_date) or dash,
                    s.show_date or dash,
                    s.show_city or s.exhibition_name or dash,
                    s.cs_type or s.cs or dash,
                    "",  # No of Box empty for child
                    s.carrier.upper() if s.carrier else dash,
                    "",  # Master AWB empty for child
                    c.get("tracking_number") or dash,
                    c_latest,
                    s.remarks or dash,
                    c_date or dash,
                ]
                _write_row(current_row, child_data)
                current_row += 1

        # Preserve orphan child records even if the master row is missing in DB.
        for master_tn, orphan_children in children_dict.items():
            if master_tn in rendered_master_tns:
                continue
            for child in orphan_children:
                is_child_delivered = (child.status == "Delivered")
                is_delivered_sheet = (ws.title == "Delivered")
                if is_child_delivered != is_delivered_sheet:
                    continue

                child_status, child_date = _build_child_latest_from_shipment(child, child)
                orphan_row = [
                    child.destination or dash,
                    child.recipient or dash,
                    _format_booking_date(child.booking_date) or dash,
                    child.show_date or dash,
                    child.show_city or child.exhibition_name or dash,
                    child.cs_type or child.cs or dash,
                    "",  # Keep child row format
                    child.carrier.upper() if child.carrier else dash,
                    master_tn,
                    child.tracking_number or dash,
                    child_status,
                    child.remarks or dash,
                    child_date or dash,
                ]
                _write_row(current_row, orphan_row)
                current_row += 1

        # Adjust column widths
        for col in ws.columns:
            max_length = 0
            column = col[0].column_letter
            for cell in col:
                try:
                    if cell.value is not None:
                        val_str = str(cell.value)
                        lines = val_str.split("\n")
                        max_line_len = max(len(line) for line in lines) if lines else 0
                        if max_line_len > max_length:
                            max_length = max_line_len
                except (ValueError, TypeError):
                    logger.warning("Failed to evaluate length for cell value: %s", cell.value)
                    pass
            ws.column_dimensions[column].width = min(max_length + 2, 40)

    # Filter top-level list by status
    top_transit = [s for s in top_level_shipments if s.status != "Delivered"]
    top_delivered = [s for s in top_level_shipments if s.status == "Delivered"]

    # Populate sheets
    _populate_sheet(ws_transit, top_transit, children_by_master)
    _populate_sheet(ws_delivered, top_delivered, children_by_master)

    # Save to buffer
    output = io.BytesIO()
    wb.save(output)
    output.seek(0)
    
    headers = {
        'Content-Disposition': f'attachment; filename="shipments_export_{today_str}.xlsx"'
    }
    return StreamingResponse(
        output,
        media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        headers=headers
    )


# ---------------------------------------------------------------------------
# Stats card counts
# ---------------------------------------------------------------------------

@router.get("/stats")
def shipment_stats(db: Session = Depends(get_session)):
    """Return counts by status for the dashboard stat cards (SQL aggregation)."""
    return get_stats(db)


@router.post("/refresh", status_code=200)
async def refresh_shipments(
    body: RefreshRequest,
    db: Session = Depends(get_session),
    _key: str = Depends(verify_api_key),
):
    """Refresh saved shipments from their carriers and hydrate missing MPS child parcels."""
    return await refresh_tracked_shipments(
        db=db,
        shipment_ids=body.shipment_ids,
        include_children=body.include_children,
    )


# ---------------------------------------------------------------------------
# List & detail
# ---------------------------------------------------------------------------

@router.get("/", response_model=List[ShipmentResponse])
def list_shipments(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_session),
):
    """List active (non-archived) shipments."""
    shipments = db.exec(select(Shipment).where(Shipment.is_archived == False).offset(skip).limit(limit)).all()
    return [_serialize_shipment(db, shipment) for shipment in shipments]


@router.get("/archived", response_model=List[ShipmentResponse])
def list_archived_shipments(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_session),
    _key: str = Depends(verify_api_key),
):
    """List archived shipments (Storage)."""
    shipments = db.exec(select(Shipment).where(Shipment.is_archived == True).offset(skip).limit(limit)).all()
    return [_serialize_shipment(db, shipment) for shipment in shipments]


@router.patch("/{shipment_id:int}/archive", response_model=ShipmentResponse)
def archive_shipment(
    shipment_id: int,
    db: Session = Depends(get_session),
    _key: str = Depends(verify_api_key),
):
    """Toggle the archive status of a shipment."""
    from app.services.shipment_service import toggle_archive
    updated = toggle_archive(shipment_id, db)
    if not updated:
        raise HTTPException(status_code=404, detail="Shipment not found")
    return _serialize_shipment(db, updated)


@router.get("/mps/{shipment_id:int}", response_model=MPSDetailResponse)
def get_mps_detail(
    shipment_id: int,
    db: Session = Depends(get_session),
):
    """
    Return full MPS detail for a master shipment: its own fields plus an
    aggregated summary of all child parcels and their individual statuses.
    Returns 404 if not found, 400 if the shipment is not an MPS master.
    """
    shipment = db.get(Shipment, shipment_id)
    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found")
    if not shipment.is_master:
        raise HTTPException(
            status_code=400,
            detail="This shipment is not a Multi-Piece Shipment master.",
        )
    return MPSDetailResponse.from_shipment(shipment)


@router.get("/{shipment_id:int}", response_model=ShipmentResponse)
def get_shipment(shipment_id: int, db: Session = Depends(get_session)):
    shipment = db.get(Shipment, shipment_id)
    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found")
    return _serialize_shipment(db, shipment)


@router.get("/project/{project_id}", response_model=List[ShipmentResponse])
def list_project_shipments(
    project_id: int,
    db: Session = Depends(get_session),
):
    shipments = db.exec(
        select(Shipment)
        .where(Shipment.project_id == project_id)
        .where(Shipment.is_archived == False)
    ).all()
    return [_serialize_shipment(db, shipment) for shipment in shipments]


# ---------------------------------------------------------------------------
# Delete
# ---------------------------------------------------------------------------

@router.delete("/{shipment_id:int}", status_code=200)
def delete_shipment(
    shipment_id: int,
    db: Session = Depends(get_session),
    _key: str = Depends(verify_api_key),
):
    from app.services.shipment_service import batch_delete

    result = batch_delete([shipment_id], db)
    if result.get("count", 0) == 0:
        raise HTTPException(status_code=404, detail="Shipment not found")
    logger.info(
        "Deleted shipment id=%d with cascade count=%d",
        shipment_id,
        result.get("count", 0),
    )
    return {
        "message": "Shipment deleted successfully",
        "deleted_id": shipment_id,
        "deleted_count": result.get("count", 0),
        "deleted_ids": result.get("deleted_ids", []),
    }


# ---------------------------------------------------------------------------
# Batch Operations
# ---------------------------------------------------------------------------

@router.post("/batch/archive", status_code=200)
def batch_archive_shipments(
    body: BatchRequest,
    db: Session = Depends(get_session),
    _key: str = Depends(verify_api_key),
):
    """Batch update archive status for multiple shipments."""
    from app.services.shipment_service import batch_update_archive
    if body.archive is None:
        raise HTTPException(status_code=400, detail="Missing 'archive' boolean in request body")
    return batch_update_archive(body.shipment_ids, body.archive, db)


@router.post("/batch/delete", status_code=200)
def batch_delete_shipments(
    body: BatchRequest,
    db: Session = Depends(get_session),
    _key: str = Depends(verify_api_key),
):
    """Batch delete multiple shipments."""
    from app.services.shipment_service import batch_delete
    return batch_delete(body.shipment_ids, db)
