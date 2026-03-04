"""
Shipments API endpoints — HTTP layer only.
All business logic lives in app.services.shipment_service.
"""
import io
import logging
from typing import List, Optional

import pandas as pd
from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, Path, UploadFile
from pydantic import BaseModel
from sqlmodel import Session, select

from app.core.security import verify_api_key
from app.db.session import get_session
from app.models.shipment import Shipment
from app.services.shipment_service import get_stats, track_and_save

logger = logging.getLogger(__name__)
router = APIRouter()

MAX_EXCEL_FILE_SIZE = 5 * 1024 * 1024  # 5 MB


class TrackRequest(BaseModel):
    """Request body for tracking a new shipment."""
    recipient: Optional[str] = None
    shipment_name: Optional[str] = None
    show_date: Optional[str] = None
    exhibition_name: str


# ---------------------------------------------------------------------------
# ENDPOINTS
# ---------------------------------------------------------------------------


@router.get("/", response_model=List[Shipment])
def get_shipments(db: Session = Depends(get_session)):
    """List all shipments tracked in DB."""
    return db.exec(select(Shipment)).all()


@router.post("/track/{tracking_number}", status_code=201)
def track_shipment(
    tracking_number: str = Path(
        ...,
        min_length=8,
        max_length=50,
        pattern=r"^[A-Z0-9]+$",
        description="Carrier tracking number (uppercase alphanumeric, 8–50 chars)",
    ),
    body: TrackRequest = ...,
    db: Session = Depends(get_session),
    _key: str = Depends(verify_api_key),
):
    """Track a shipment via carrier API and save/update in DB."""
    result = track_and_save(
        tracking_number=tracking_number.upper(),
        recipient=body.recipient,
        items=body.shipment_name,
        show_date=body.show_date,
        exhibition_name=body.exhibition_name,
        db=db,
    )
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


# ---------------------------------------------------------------------------
# Batch import from Excel — uses BackgroundTasks so the response is immediate
# ---------------------------------------------------------------------------

def _process_excel_import(contents: bytes, db: Session):
    """Parse Excel rows and track each shipment synchronously."""
    df = pd.read_excel(io.BytesIO(contents))
    df.columns = [c.strip().lower().replace(" ", "_") for c in df.columns]

    if "tracking_number" not in df.columns:
        logger.error("Excel import: missing required 'tracking_number' column")
        return {"error": "Missing required 'tracking_number' column", "success": 0, "failed": 0}

    success = 0
    failed = 0
    errors = []
    
    for _, row in df.iterrows():
        tracking_num = str(row.get("tracking_number", "")).strip()
        if not tracking_num or tracking_num.lower() == "nan":
            continue

        # Attempt to get 'name' or 'items' from Excel row for both manual label and items field
        items_name = (
            str(row.get("name") or row.get("items") or "")
            if ("name" in df.columns or "items" in df.columns)
            and (pd.notna(row.get("name")) or pd.notna(row.get("items")))
            else None
        )

        recipient = (
            str(row.get("recipient"))
            if "recipient" in df.columns and pd.notna(row.get("recipient"))
            else items_name
        )

        show_date = (
            str(row.get("show_date"))
            if "show_date" in df.columns and pd.notna(row.get("show_date"))
            else None
        )

        # Attempt to get exhibition_name
        exhibition_name = str(row.get("exhibition_name", "")).strip()
        if not exhibition_name or exhibition_name.lower() == "nan":
            exhibition_name = "Unknown Exhibition"

        # Call track_and_save with correct positional arguments:
        # tracking_number, recipient, items, show_date, exhibition_name, db
        res = track_and_save(tracking_num.upper(), recipient, items_name, show_date, exhibition_name, db)
        if "error" in res:
            err_msg = res["error"]
            logger.warning("Import failed for %s: %s", tracking_num, err_msg)
            failed += 1
            errors.append(f"{tracking_num}: {err_msg}")
        else:
            success += 1

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
    Processing runs synchronously.
    Expected columns: tracking_number, name (optional), show_date (optional)
    """
    if not (file.filename or "").lower().endswith((".xlsx", ".xls")):
        raise HTTPException(status_code=400, detail="Invalid file format. Upload an .xlsx or .xls file.")

    contents = await file.read(MAX_EXCEL_FILE_SIZE + 1)
    if len(contents) > MAX_EXCEL_FILE_SIZE:
        raise HTTPException(status_code=413, detail="File too large. Maximum allowed size is 5 MB.")

    result = _process_excel_import(contents, db)
    
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
        
    return {
        "status": "completed",
        "success": result["success"],
        "failed": result["failed"],
        "errors": result["errors"],
        "message": f"Successfully imported {result['success']} shipments. {result['failed']} failed.",
    }


# ---------------------------------------------------------------------------
# Stats card counts
# ---------------------------------------------------------------------------

@router.get("/stats")
def shipment_stats(db: Session = Depends(get_session)):
    """Return counts by status for the dashboard stat cards (SQL aggregation)."""
    return get_stats(db)


# ---------------------------------------------------------------------------
# List & detail
# ---------------------------------------------------------------------------

@router.get("/", response_model=List[Shipment])
def list_shipments(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_session),
):
    return db.exec(select(Shipment).offset(skip).limit(limit)).all()


@router.get("/{shipment_id}", response_model=Shipment)
def get_shipment(shipment_id: int, db: Session = Depends(get_session)):
    shipment = db.get(Shipment, shipment_id)
    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found")
    return shipment


# ---------------------------------------------------------------------------
# Delete
# ---------------------------------------------------------------------------

@router.delete("/{shipment_id}", status_code=200)
def delete_shipment(
    shipment_id: int,
    db: Session = Depends(get_session),
    _key: str = Depends(verify_api_key),
):
    shipment = db.get(Shipment, shipment_id)
    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found")
    db.delete(shipment)
    db.commit()
    logger.info("Deleted shipment id=%d", shipment_id)
    return {"message": "Shipment deleted successfully", "deleted_id": shipment_id}
