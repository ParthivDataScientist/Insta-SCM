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
    db: Session,
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
            show_date=show_date,
            origin=result.get("origin", "Unknown"),
            destination=result.get("destination", "Unknown"),
            eta=result.get("eta", "TBD"),
            progress=result.get("progress", 0),
            items=items or "Package",
            history=result.get("history", []),
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

        logger.info("Updated shipment record for %s", tracking_number)

    db.add(shipment)
    db.commit()
    db.refresh(shipment)

    return {"tracking_number": tracking_number, "status": "success", "carrier": carrier_name}


def get_stats(db: Session) -> dict:
    """
    Return shipment counts aggregated in SQL (not Python) for performance.
    """
    result = db.exec(
        select(
            func.count().label("total"),
            func.sum(
                case((Shipment.status == "Delivered", 1), else_=0)
            ).label("delivered"),
            func.sum(
                case((Shipment.status.in_(["In Transit", "Out for Delivery"]), 1), else_=0)
            ).label("transit"),
            func.sum(
                case((Shipment.status == "Exception", 1), else_=0)
            ).label("exceptions"),
        )
    ).one()

    return {
        "total": result.total or 0,
        "delivered": result.delivered or 0,
        "transit": result.transit or 0,
        "exceptions": result.exceptions or 0,
    }
