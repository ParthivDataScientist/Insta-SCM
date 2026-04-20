"""
Shipment Service Layer
Encapsulates all business logic for tracking and managing shipments.
Endpoints should call these functions instead of containing business logic directly.
"""
import logging
from datetime import datetime, timezone
from typing import Optional, Sequence

from sqlmodel import Session, select
from sqlalchemy import func, case

from app.models.shipment import Shipment
from app.services.fedex import FedExService
from app.services.dhl import DHLService
from app.services.carrier_detection import detect_carrier

logger = logging.getLogger(__name__)
STUCK_THRESHOLD_DAYS = 2
STUCK_THRESHOLD_SECONDS = STUCK_THRESHOLD_DAYS * 24 * 60 * 60


def _parse_event_datetime(raw_value: str) -> Optional[datetime]:
    token = str(raw_value or "").strip()
    if not token:
        return None

    normalized = token.replace("Z", "+00:00")
    try:
        dt = datetime.fromisoformat(normalized)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)
    except ValueError:
        pass

    for fmt in (
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%d %H:%M",
        "%Y-%m-%d",
        "%d-%m-%Y %H:%M:%S",
        "%d-%m-%Y",
        "%d/%m/%Y %H:%M:%S",
        "%d/%m/%Y",
        "%m/%d/%Y %H:%M:%S",
        "%m/%d/%Y",
    ):
        try:
            dt = datetime.strptime(token, fmt).replace(tzinfo=timezone.utc)
            return dt
        except ValueError:
            continue
    return None


def _normalize_location(value: Optional[str]) -> str:
    return " ".join(str(value or "").strip().lower().split())


def _is_delivered_status(status: str) -> bool:
    return str(status or "").strip().lower() == "delivered"


def _is_stuck_keyword_present(result: dict) -> bool:
    blob = " ".join(
        str(result.get(key, "") or "")
        for key in ("status", "raw_status", "current_status")
    ).lower()
    keywords = (
        "delay",
        "delayed",
        "hold",
        "held",
        "stuck",
        "shipment exception",
        "clearance delay",
        "exception",
    )
    return any(keyword in blob for keyword in keywords)


def _apply_stuck_policy_to_child_parcels(result: dict, now_utc: datetime) -> None:
    child_parcels = result.get("child_parcels")
    if not isinstance(child_parcels, list):
        return

    for parcel in child_parcels:
        if not isinstance(parcel, dict):
            continue
        if _is_delivered_status(parcel.get("status", "")):
            continue

        last_date = _parse_event_datetime(parcel.get("last_date", ""))
        if last_date is None:
            continue
        if (now_utc - last_date).total_seconds() > STUCK_THRESHOLD_SECONDS:
            parcel["status"] = "Exception"


def _apply_stuck_exception_policy(result: dict) -> dict:
    """
    Carrier-agnostic stuck detection:
    1) If latest checkpoint is older than 2 days (and not delivered) => Exception.
    2) If same location has persisted for over 2 days => Exception.
    3) If carrier text already signals delay/hold/stuck => Exception.
    """
    if not isinstance(result, dict) or "error" in result:
        return result

    current_status = str(result.get("status", "") or "")
    if _is_delivered_status(current_status):
        return result

    history = result.get("history")
    events = history if isinstance(history, list) else []

    now_utc = datetime.now(timezone.utc)
    reasons: list[str] = []
    latest_dt: Optional[datetime] = None
    latest_loc = ""

    parsed_events = []
    for idx, event in enumerate(events):
        if not isinstance(event, dict):
            continue
        dt = _parse_event_datetime(event.get("date", ""))
        loc = _normalize_location(event.get("location"))
        parsed_events.append((idx, dt, loc, event))

    if parsed_events:
        parsed_events.sort(
            key=lambda item: (
                item[1] is not None,
                item[1].timestamp() if item[1] else float("-inf"),
                -item[0],
            ),
            reverse=True,
        )
        _, latest_dt, latest_loc, _ = parsed_events[0]

    if latest_dt and (now_utc - latest_dt).total_seconds() > STUCK_THRESHOLD_SECONDS:
        reasons.append("no_movement_over_2_days")

    if latest_dt and latest_loc:
        oldest_same_loc_dt = latest_dt
        for _, dt, loc, _ in parsed_events[1:]:
            if loc != latest_loc:
                break
            if dt:
                oldest_same_loc_dt = dt
        if (latest_dt - oldest_same_loc_dt).total_seconds() > STUCK_THRESHOLD_SECONDS:
            reasons.append("same_location_over_2_days")

    if _is_stuck_keyword_present(result):
        reasons.append("carrier_marked_delay_or_hold")

    if reasons:
        result["status"] = "Exception"
        result["progress"] = 10
        result["stuck_detected"] = True
        result["stuck_reasons"] = list(dict.fromkeys(reasons))

    _apply_stuck_policy_to_child_parcels(result, now_utc)
    return result


def track_and_save(
    tracking_number: str,
    recipient: Optional[str],
    items: Optional[str],
    show_date: Optional[str],
    exhibition_name: str,
    db: Session,
    cs: Optional[str] = None,
    no_of_box: Optional[str] = None,
    project_id: Optional[int] = None,
    booking_date: Optional[str] = None,
    show_city: Optional[str] = None,
    cs_type: Optional[str] = None,
    remarks: Optional[str] = None,
    last_scan_date: Optional[str] = None,
    master_tracking_number: Optional[str] = None,
    is_master: Optional[bool] = None,
    destination: Optional[str] = None,
) -> dict:
    """
    Detect carrier, call tracking API, then upsert the shipment record in DB.
    Returns a result dict. On error, the dict will contain an 'error' key.
    """
    carrier_name = detect_carrier(tracking_number)

    if carrier_name == "DHL":
        service = DHLService()
    elif carrier_name == "FedEx":
        service = FedExService()
    elif carrier_name == "UPS":
        return {
            "tracking_number": tracking_number,
            "error": "UPS tracking is not yet supported. Supported carriers: FedEx, DHL.",
        }
    else:
        return {
            "tracking_number": tracking_number,
            "error": f"Could not detect carrier for tracking number '{tracking_number}'. "
                     "Supported formats: FedEx (12/15/20/22 digits), DHL (10 digits), UPS (1Z...).",
        }

    result = service.track(tracking_number)

    if "error" in result:
        logger.warning("Tracking failed for %s (%s): %s", tracking_number, carrier_name, result["error"])
        return {"tracking_number": tracking_number, "error": result["error"]}

    result = _apply_stuck_exception_policy(result)

    destination_input = (destination or "").strip()
    api_destination = result.get("destination")
    resolved_destination = (
        api_destination
        if api_destination and api_destination != "Unknown"
        else (destination_input or "Unknown")
    )

    # Upsert: find existing record or create new one
    statement = select(Shipment).where(Shipment.tracking_number == tracking_number)
    shipment = db.exec(statement).first()

    if not shipment:
        shipment = Shipment(
            tracking_number=tracking_number,
            carrier=carrier_name,
            status=result.get("status", "Unknown"),
            recipient=recipient or "",
            exhibition_name=exhibition_name,
            show_date=show_date,
            project_id=project_id,
            origin=result.get("origin", "Unknown"),
            destination=resolved_destination,
            eta=result.get("eta", "TBD"),
            progress=result.get("progress", 0),
            items=items or "Package",
            history=result.get("history", []),
            cs=cs,
            no_of_box=no_of_box,
            booking_date=booking_date,
            show_city=show_city,
            cs_type=cs_type,
            remarks=remarks,
            last_scan_date=result.get("last_scan_date", last_scan_date),
            master_tracking_number=master_tracking_number or result.get("master_tracking_number"),
            is_master=is_master if is_master is not None else result.get("is_master", False),
            child_parcels=result.get("child_parcels", []),
        )
        logger.info("Created new shipment record for %s (%s)", tracking_number, carrier_name)
    else:
        shipment.status = result.get("status", shipment.status)

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
        if last_scan_date is not None:
            shipment.last_scan_date = last_scan_date


        # Only update fields if the API returned meaningful data
        if result.get("origin") and result.get("origin") != "Unknown":
            shipment.origin = result["origin"]
        if api_destination and api_destination != "Unknown":
            shipment.destination = api_destination
        elif destination_input:
            shipment.destination = destination_input
        if result.get("eta") and result.get("eta") not in ("Unknown", "TBD"):
            shipment.eta = result["eta"]
        if result.get("progress") is not None:
            shipment.progress = result["progress"]
        if result.get("history"):
            shipment.history = result["history"]
            
        # MPS updates
        if master_tracking_number is not None:
            shipment.master_tracking_number = master_tracking_number
        elif result.get("master_tracking_number"):
            shipment.master_tracking_number = result["master_tracking_number"]
            
        if is_master is not None:
            shipment.is_master = is_master
        elif "is_master" in result:
            shipment.is_master = result["is_master"]
        if result.get("child_parcels") is not None:
            # Reassigning the list so SQLModel detects the JSON change
            shipment.child_parcels = list(result["child_parcels"])

        logger.info("Updated shipment record for %s", tracking_number)

    db.add(shipment)
    db.commit()
    db.refresh(shipment)

    return {"tracking_number": tracking_number, "status": "success", "carrier": carrier_name}


def get_stats(db: Session) -> dict:
    """
    Return counts for main shipments and total child parcels.
    A 'main' shipment is either an MPS master or a standalone parcel.
    """
    # Simple inclusive count of all non-archived shipments to match the main list view
    main_query = select(
        func.count().label("total"),
        func.sum(case((Shipment.status == "Delivered", 1), else_=0)).label("delivered"),
        func.sum(case((Shipment.status.in_(["In Transit", "Out for Delivery"]), 1), else_=0)).label("transit"),
        func.sum(case((Shipment.status == "Exception", 1), else_=0)).label("exceptions"),
    ).where(Shipment.is_archived == False)
    main_result = db.exec(main_query).one()

    # Child parcel counts (summing the JSON arrays from master records)
    # We use a simple select and sum in Python here for JSON compatibility across DBs,
    # or we can try to use SQL func if we're sure about the JSON structure.
    # Given the small scale, fetching masters and summing is safer.
    masters = db.exec(select(Shipment).where(
        (Shipment.is_master == True) & (Shipment.is_archived == False)
    )).all()
    
    child_total = 0
    child_delivered = 0
    child_transit = 0
    child_exceptions = 0
    
    for m in masters:
        parcels = m.child_parcels or []
        child_total += len(parcels)
        for p in parcels:
            status = p.get("status")
            if status == "Delivered":
                child_delivered += 1
            elif status in ("In Transit", "Out for Delivery"):
                child_transit += 1
            elif status == "Exception":
                child_exceptions += 1

    return {
        "total": main_result.total or 0,
        "delivered": main_result.delivered or 0,
        "transit": main_result.transit or 0,
        "exceptions": main_result.exceptions or 0,
        "child_stats": {
            "total": child_total,
            "delivered": child_delivered,
            "transit": child_transit,
            "exceptions": child_exceptions
        }
    }


def preview_track(tracking_number: str) -> dict:
    """
    Fetch live tracking data from the carrier API WITHOUT saving to the DB.
    Returns the full result dict (including history, origin, destination, eta).
    On error, the dict will contain an 'error' key.
    """
    carrier_name = detect_carrier(tracking_number)

    if carrier_name == "DHL":
        service = DHLService()
    elif carrier_name == "FedEx":
        service = FedExService()
    elif carrier_name == "UPS":
        return {"error": "UPS tracking is not yet supported."}
    else:
        return {"error": f"Could not detect carrier for '{tracking_number}'."}

    result = service.track(tracking_number)
    if "error" in result:
        return result

    result = _apply_stuck_exception_policy(result)

    # Attach metadata the frontend needs
    result["tracking_number"] = tracking_number
    result["carrier"] = carrier_name
    return result


def refresh_tracked_shipments(
    db: Session,
    shipment_ids: Optional[Sequence[int]] = None,
    include_archived: bool = False,
    include_children: bool = False,
) -> dict:
    """
    Re-sync one or more saved shipments from the carrier APIs.
    Useful for pulling fresh statuses and hydrating MPS child parcels that may
    have been missing in older saved records.
    """
    statement = select(Shipment)
    if shipment_ids:
        statement = statement.where(Shipment.id.in_(list(shipment_ids)))
    # By default, refresh only top-level shipments (masters + standalone)
    # to avoid expensive N+1 carrier calls for child records.
    if not shipment_ids and not include_children:
        statement = statement.where(
            (Shipment.master_tracking_number.is_(None))
            | (Shipment.master_tracking_number == "")
        )
    if not include_archived:
        statement = statement.where(Shipment.is_archived == False)

    shipments = db.exec(statement).all()
    refreshed = 0
    errors: list[str] = []

    for shipment in shipments:
        result = track_and_save(
            tracking_number=shipment.tracking_number,
            recipient=shipment.recipient,
            items=shipment.items,
            show_date=shipment.show_date,
            exhibition_name=shipment.exhibition_name or "Unknown Exhibition",
            db=db,
            cs=shipment.cs,
            no_of_box=shipment.no_of_box,
            project_id=shipment.project_id,
        )
        if "error" in result:
            errors.append(f"{shipment.tracking_number}: {result['error']}")
        else:
            refreshed += 1

    return {
        "requested": len(shipments),
        "refreshed": refreshed,
        "failed": len(errors),
        "errors": errors,
    }


def toggle_archive(shipment_id: int, db: Session) -> Optional[Shipment]:
    """
    Toggle the is_archived flag for a shipment.
    Returns the updated shipment or None if not found.
    """
    shipment = db.get(Shipment, shipment_id)
    if not shipment:
        return None
    
    shipment.is_archived = not shipment.is_archived
    db.add(shipment)
    db.commit()
    db.refresh(shipment)
    return shipment


def batch_update_archive(shipment_ids: list[int], archive: bool, db: Session) -> dict:
    """Batch update the is_archived status for multiple shipments."""
    statement = select(Shipment).where(Shipment.id.in_(shipment_ids))
    shipments = db.exec(statement).all()
    
    for s in shipments:
        s.is_archived = archive
        db.add(s)
    
    db.commit()
    return {"status": "success", "count": len(shipments)}


def batch_delete(shipment_ids: list[int], db: Session) -> dict:
    """
    Batch delete multiple shipments.

    If a top-level/master shipment is deleted, all linked child rows
    (where child.master_tracking_number == master.tracking_number) are
    deleted as well so the UI cannot surface orphan child records.
    """
    if not shipment_ids:
        return {"status": "success", "count": 0, "deleted_ids": []}

    requested = db.exec(select(Shipment).where(Shipment.id.in_(shipment_ids))).all()
    if not requested:
        return {"status": "success", "count": 0, "deleted_ids": []}

    ids_to_delete: set[int] = {s.id for s in requested if s.id is not None}

    # Only selected top-level records should cascade downward to children.
    top_level_master_tns = {
        (s.tracking_number or "").strip().upper()
        for s in requested
        if not (s.master_tracking_number or "").strip()
    }

    if top_level_master_tns:
        child_rows = db.exec(
            select(Shipment).where(
                func.upper(func.trim(func.coalesce(Shipment.master_tracking_number, ""))).in_(
                    list(top_level_master_tns)
                )
            )
        ).all()
        for child in child_rows:
            if child.id is not None:
                ids_to_delete.add(child.id)

    shipments = db.exec(select(Shipment).where(Shipment.id.in_(list(ids_to_delete)))).all()
    deleted_ids: list[int] = []
    for shipment in shipments:
        if shipment.id is not None:
            deleted_ids.append(shipment.id)
        db.delete(shipment)

    db.commit()
    return {"status": "success", "count": len(deleted_ids), "deleted_ids": deleted_ids}
