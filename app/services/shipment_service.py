"""
Shipment Service Layer
Encapsulates all business logic for tracking and managing shipments.
Endpoints should call these functions instead of containing business logic directly.
"""
import logging
from typing import Optional

from sqlmodel import Session, select
from sqlalchemy import func, case

from app.models.shipment import Shipment
from app.services.fedex import FedExService
from app.services.dhl import DHLService
from app.services.carrier_detection import detect_carrier

logger = logging.getLogger(__name__)


def track_and_save(
    tracking_number: str,
    recipient: Optional[str],
    items: Optional[str],
    show_date: Optional[str],
    exhibition_name: str,
    db: Session,
    cs: Optional[str] = None,
    no_of_box: Optional[str] = None,
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
            origin=result.get("origin", "Unknown"),
            destination=result.get("destination", "Unknown"),
            eta=result.get("eta", "TBD"),
            progress=result.get("progress", 0),
            items=items or "Package",
            history=result.get("history", []),
            cs=cs,
            no_of_box=no_of_box,
            master_tracking_number=result.get("master_tracking_number"),
            is_master=result.get("is_master", False),
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
        if no_of_box:
            shipment.no_of_box = no_of_box

        # Only update fields if the API returned meaningful data
        if result.get("origin") and result.get("origin") != "Unknown":
            shipment.origin = result["origin"]
        if result.get("destination") and result.get("destination") != "Unknown":
            shipment.destination = result["destination"]
        if result.get("eta") and result.get("eta") not in ("Unknown", "TBD"):
            shipment.eta = result["eta"]
        if result.get("progress") is not None:
            shipment.progress = result["progress"]
        if result.get("history"):
            shipment.history = result["history"]
            
        # MPS updates
        if result.get("master_tracking_number"):
            shipment.master_tracking_number = result["master_tracking_number"]
        if "is_master" in result:
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
    # Main shipment counts (where it's not a child of another record in DB)
    main_query = select(
        func.count().label("total"),
        func.sum(case((Shipment.status == "Delivered", 1), else_=0)).label("delivered"),
        func.sum(case((Shipment.status.in_(["In Transit", "Out for Delivery"]), 1), else_=0)).label("transit"),
        func.sum(case((Shipment.status == "Exception", 1), else_=0)).label("exceptions"),
    ).where(
        ((Shipment.is_master == True) | (Shipment.master_tracking_number == None)) &
        (Shipment.is_archived == False)
    )
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

    # Attach metadata the frontend needs
    result["tracking_number"] = tracking_number
    result["carrier"] = carrier_name
    return result


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
    """Batch delete multiple shipments."""
    statement = select(Shipment).where(Shipment.id.in_(shipment_ids))
    shipments = db.exec(statement).all()
    
    for s in shipments:
        db.delete(s)
    
    db.commit()
    return {"status": "success", "count": len(shipments)}
