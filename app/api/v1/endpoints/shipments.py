"""
Shipments API endpoints — HTTP layer only.
All business logic lives in app.services.shipment_service.
"""
import io
import logging
from typing import List, Optional

import pandas as pd
from fastapi import APIRouter, Depends, File, HTTPException, Path, UploadFile
from fastapi.responses import StreamingResponse
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel
from sqlmodel import Session, select

from app.core.security import verify_api_key
from app.db.session import get_session
from app.models.dashboard_project import DashboardProject
from app.models.shipment import Shipment
from app.schemas.shipment import MPSDetailResponse, ShipmentResponse
from app.services.shipment_service import get_stats, track_and_save, preview_track, refresh_tracked_shipments

logger = logging.getLogger(__name__)
router = APIRouter()

MAX_EXCEL_FILE_SIZE = 5 * 1024 * 1024  # 5 MB


class TrackRequest(BaseModel):
    """Request body for tracking a new shipment."""
    recipient: Optional[str] = None
    shipment_name: Optional[str] = None
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
def preview_shipment(
    tracking_number: str = Path(
        ...,
        min_length=8,
        max_length=50,
        description="Carrier tracking number to preview (no DB save)",
    ),
    _key: str = Depends(verify_api_key),
):
    """Fetch live tracking data for a tracking number WITHOUT saving to the database."""
    result = preview_track(tracking_number.upper())
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


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
    if body.project_id is None:
        raise HTTPException(status_code=400, detail="project_id is required")
    _validate_project_reference(db, body.project_id)
    result = track_and_save(
        tracking_number=tracking_number.upper(),
        recipient=body.recipient,
        items=body.shipment_name,
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

        cs = str(row.get("cs") or row.get("c/s") or "").strip() if pd.notna(row.get("cs")) or pd.notna(row.get("c/s")) else None
        no_of_box = str(row.get("no_of_box") or row.get("boxes") or "").strip() if pd.notna(row.get("no_of_box")) or pd.notna(row.get("boxes")) else None

        # Call track_and_save with correct arguments
        project_id = int(row["project_id"]) if "project_id" in df.columns and pd.notna(row.get("project_id")) else None

        if project_id is not None and not db.get(DashboardProject, project_id):
            failed += 1
            errors.append(f"{tracking_num}: linked project not found")
            continue

        res = track_and_save(
            tracking_number=tracking_num.upper(),
            recipient=recipient,
            items=items_name,
            show_date=show_date,
            exhibition_name=exhibition_name,
            db=db,
            cs=cs,
            no_of_box=no_of_box,
            project_id=project_id,
        )
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
    Processing runs in a threadpool to prevent blocking the async event loop.
    Expected columns: tracking_number, name (optional), show_date (optional)
    """
    if not (file.filename or "").lower().endswith((".xlsx", ".xls")):
        raise HTTPException(status_code=400, detail="Invalid file format. Upload an .xlsx or .xls file.")

    contents = await file.read(MAX_EXCEL_FILE_SIZE + 1)
    if len(contents) > MAX_EXCEL_FILE_SIZE:
        raise HTTPException(status_code=413, detail="File too large. Maximum allowed size is 5 MB.")

    result = await run_in_threadpool(_process_excel_import, contents, db)
    
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
        
    return {
        "status": "completed",
        "success": result["success"],
        "failed": result["failed"],
        "errors": result["errors"],
        "message": f"Successfully imported {result['success']} shipments. {result['failed']} failed.",
    }


@router.get("/export-excel")
def export_shipments(
    db: Session = Depends(get_session),
    _key: str = Depends(verify_api_key),
):
    """Export non-archived shipments to Excel with requested formatting."""
    from openpyxl.styles import PatternFill, Font, Alignment, Border, Side
    from datetime import datetime

    # Fetch all non-archived shipments
    shipments = db.exec(select(Shipment).where(Shipment.is_archived == False)).all()
    
    # Create Workbook
    from openpyxl import Workbook
    wb = Workbook()
    ws = wb.active
    ws.title = "Shipments"

    today_str = datetime.now().strftime("%d.%m.%Y")
    
    headers = [
        "Ship to location", "Client Name", "Booking dt.", "Show date", 
        "Show City", "C/S", "No of Box", "Courier", "Master AWB", 
        "Child AWB #", today_str
    ]
    
    # Styles
    header_font = Font(bold=True)
    header_fill = PatternFill(start_color="D9D9D9", end_color="D9D9D9", fill_type="solid")
    yellow_fill = PatternFill(start_color="FFFF00", end_color="FFFF00", fill_type="solid")
    alignment_center = Alignment(horizontal="center", vertical="center")
    border = Border(left=Side(style='thin'), right=Side(style='thin'), top=Side(style='thin'), bottom=Side(style='thin'))

    # Write headers
    for col, header in enumerate(headers, 1):
        cell = ws.cell(row=1, column=col, value=header)
        cell.font = header_font
        cell.fill = header_fill
        cell.border = border
        cell.alignment = alignment_center

    current_row = 2
    for s in shipments:
        # Latest Update logic
        if s.history:
            latest = s.history[0]
            h_date = ""
            try:
                dt = datetime.fromisoformat(latest["date"].replace("Z", "+00:00"))
                h_date = dt.strftime("%d.%m.%Y")
            except:
                h_date = latest.get("date", "")[:10]
            
            loc = f" {latest.get('location', '')}" if latest.get('location') else ""
            eta_str = f" ETA : {s.eta}" if s.eta and s.eta not in ("Unknown", "TBD", "Pending") else ""
            latest_status = f"{h_date} : {latest.get('description', '')}{loc}{eta_str}"
        else:
            eta_str = f" ETA : {s.eta}" if s.eta and s.eta not in ("Unknown", "TBD", "Pending") else ""
            latest_status = f"{s.status}{eta_str}"

        # Master Row
        row_data = [
            s.destination or "—",
            s.recipient or "—",
            s.created_at.strftime("%d.%m.%Y") if s.created_at else "—",
            s.show_date or "—",
            s.exhibition_name or "—",
            s.cs or "—",
            s.no_of_box or "—",
            s.carrier.upper() if s.carrier else "—",
            s.tracking_number,
            "",  # Child AWB is empty on master row
            latest_status
        ]
        
        for col, val in enumerate(row_data, 1):
            cell = ws.cell(row=current_row, column=col, value=val)
            cell.border = border
            if headers[col-1] == "Show date":
                cell.fill = yellow_fill
            if col in [3, 8]: # Booking dt. and Courier center aligned
                cell.alignment = alignment_center
            if col == 9: # Master AWB bold
                cell.font = Font(bold=True)

        current_row += 1

        # Child Rows
        if s.child_parcels:
            for c in s.child_parcels:
                # Latest Update for child
                # Event Date: use last_date if available (newly added), otherwise fallback to booking date
                c_date = ""
                if c.get("last_date"):
                    try:
                        dt = datetime.fromisoformat(c["last_date"].replace("Z", "+00:00"))
                        c_date = dt.strftime("%d.%m.%Y")
                    except:
                        c_date = c["last_date"][:10]
                else:
                    c_date = s.created_at.strftime('%d.%m.%Y') if s.created_at else ''

                # Status Fallback: If child status is generic, try to use master's current detail if dates match
                c_status = c.get("raw_status") or c.get("status") or "Unknown"
                c_loc = c.get("last_location") or ""
                
                if (not c_loc or c_status.lower() in ("unknown", "delivery updated", "in transit")) and s.history:
                    # If child info is sparse, use master's latest info as it's likely moving together
                    master_latest = s.history[0]
                    c_status = master_latest.get("description", c_status)
                    c_loc = master_latest.get("location", c_loc)

                c_loc_str = f" {c_loc}" if c_loc else ""
                
                # ETA: Use child's own ETA, fallback to master ETA
                c_eta = c.get("eta")
                if not c_eta or c_eta in ("Unknown", "TBD", "Pending"):
                    c_eta = s.eta
                
                eta_str = f" ETA : {c_eta}" if c_eta and c_eta not in ("Unknown", "TBD", "Pending") else ""
                c_latest = f"{c_date} : {c_status}{c_loc_str}{eta_str}"
                
                
                child_data = [
                    s.destination or "—",
                    s.recipient or "—",
                    s.created_at.strftime("%d.%m.%Y") if s.created_at else "—",
                    s.show_date or "—",
                    s.exhibition_name or "—",
                    s.cs or "—",
                    "",  # No of Box empty for child
                    s.carrier.upper() if s.carrier else "—",
                    "",  # Master AWB empty for child
                    c.get("tracking_number"),
                    c_latest
                ]
                for col, val in enumerate(child_data, 1):
                    cell = ws.cell(row=current_row, column=col, value=val)
                    cell.border = border
                    if headers[col-1] == "Show date":
                        cell.fill = yellow_fill
                    if col in [3, 8]:
                        cell.alignment = alignment_center
                current_row += 1

    # Adjust column widths
    for col in ws.columns:
        max_length = 0
        column = col[0].column_letter
        for cell in col:
            try:
                if len(str(cell.value)) > max_length:
                    max_length = len(str(cell.value))
            except:
                pass
        ws.column_dimensions[column].width = min(max_length + 2, 40)

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
def refresh_shipments(
    body: RefreshRequest,
    db: Session = Depends(get_session),
    _key: str = Depends(verify_api_key),
):
    """Refresh saved shipments from their carriers and hydrate missing MPS child parcels."""
    return refresh_tracked_shipments(db=db, shipment_ids=body.shipment_ids)


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


@router.patch("/{shipment_id}/archive", response_model=ShipmentResponse)
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


@router.get("/mps/{shipment_id}", response_model=MPSDetailResponse)
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


@router.get("/{shipment_id}", response_model=ShipmentResponse)
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
