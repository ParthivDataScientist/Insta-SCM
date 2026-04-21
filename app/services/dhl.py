import logging
from typing import Any, Dict

from .carrier_base import CarrierService, HISTORY_STATUS_MAP
from .dhl_provider import DHLProvider
from .dhl_validation import sanitize_dhl_awb

logger = logging.getLogger(__name__)


def _normalize_dhl_tracking_number(tracking_number: str) -> str:
    """
    Normalize DHL tracking numbers from import flows.
    Common issue: Excel numeric cells become values like `1234567890.0`.
    """
    return sanitize_dhl_awb(tracking_number)

# Map DHL status code/description to dashboard categories
DHL_STATUS_MAP = {
    "delivered": "Delivered",
    "delivery successful": "Delivered",
    "shipment delivered": "Delivered",
    "transit": "In Transit",
    "in transit": "In Transit",
    "departed": "In Transit",
    "arrived": "In Transit",
    "processed": "In Transit",
    "sorted": "In Transit",
    "picked up": "In Transit",
    "shipment picked up": "In Transit",
    "out for delivery": "Out for Delivery",
    "with delivery courier": "Out for Delivery",
    "exception": "Exception",
    "held": "Exception",
    "customs": "Exception",
    "delay": "Exception",
    "returned": "Exception",
}


def map_dhl_status(status_str: str) -> str:
    """Map a raw DHL status string to our dashboard status categories."""
    lower = status_str.lower().strip()

    if lower in DHL_STATUS_MAP:
        return DHL_STATUS_MAP[lower]

    # Sorted by key length (longest first) for specificity
    for key in sorted(DHL_STATUS_MAP.keys(), key=len, reverse=True):
        if key in lower:
            return DHL_STATUS_MAP[key]

    if any(token in lower for token in ("out for delivery", "with delivery courier", "with courier")):
        return "Out for Delivery"

    delivered_markers = (
        "shipment delivered",
        "delivery successful",
        "proof of delivery",
        "delivered",
    )
    if any(marker in lower for marker in delivered_markers):
        if not any(token in lower for token in ("delivery facility", "out for delivery", "scheduled for delivery", "attempted")):
            return "Delivered"

    return "In Transit"


class DHLService(CarrierService):
    def __init__(self):
        self.provider = DHLProvider()

    def track(self, tracking_number: str) -> Dict[str, Any]:
        """Track a shipment using DHL Express India SOAP/WCF PostTracking."""
        normalized_tracking_number = _normalize_dhl_tracking_number(tracking_number)
        if normalized_tracking_number != tracking_number:
            logger.info(
                "Normalized DHL tracking number from '%s' to '%s'",
                tracking_number,
                normalized_tracking_number,
            )

        return self.provider.track(normalized_tracking_number)

    def _extract_piece_data(self, shipment: Dict[str, Any]) -> Dict[str, Any]:
        """Helper to extract common fields from a single shipment/piece object."""
        events = shipment.get("events", [])
        
        # --- Status (shipment-level) ---
        status_obj = shipment.get("status", {})
        raw_status = status_obj.get("status", "Unknown")
        shipment_status = map_dhl_status(raw_status)

        # --- Origin & Destination ---
        origin_obj = shipment.get("origin", {}).get("address", {})
        origin = f"{origin_obj.get('addressLocality', '')}, {origin_obj.get('countryCode', '')}".strip(", ")
        if not origin and events:
            # Fallback to first event location
            last_event = events[-1]
            loc_obj = last_event.get("location", {}).get("address", {})
            origin = f"{loc_obj.get('addressLocality', '')}, {loc_obj.get('countryCode', '')}".strip(", ")

        dest_obj = shipment.get("destination", {}).get("address", {})
        destination = f"{dest_obj.get('addressLocality', '')}, {dest_obj.get('countryCode', '')}".strip(", ")

        # --- ETA ---
        eta = shipment.get("estimatedDeliveryDate", "Unknown")
        if eta != "Unknown":
            eta = eta.split("T")[0] if "T" in eta else eta[:10]

        # --- History ---
        history = []
        for event in events:
            desc = event.get("description", "")
            location_obj = event.get("location", {}).get("address", {})
            loc = f"{location_obj.get('addressLocality', '')}, {location_obj.get('countryCode', '')}".strip(", ")
            
            # Unified API might have 'timestamp' or 'date' + 'time'
            timestamp = event.get("timestamp")
            if not timestamp:
                timestamp = (event.get("date", "") + " " + event.get("time", "")).strip()

            type_code = event.get("typeCode", "")
            event_status = HISTORY_STATUS_MAP.get(type_code, type_code)

            history.append({
                "description": desc,
                "location": loc,
                "status": event_status,
                "date": timestamp,
            })
        
        # Ensure newest first
        history.sort(key=lambda x: x["date"], reverse=True)

        # --- Progress ---
        progress_map = {
            "Delivered": 100,
            "Out for Delivery": 80,
            "In Transit": 40,
            "Exception": 10,
        }
        progress = progress_map.get(shipment_status, 0)

        return {
            "status": shipment_status,
            "raw_status": raw_status,
            "origin": origin,
            "destination": destination,
            "eta": eta,
            "progress": progress,
            "history": history,
        }

    def _standardize_response(self, raw_data: Dict, tracking_number: str) -> Dict[str, Any]:
        try:
            shipments = raw_data.get("shipments", [])
            if not shipments:
                return {"error": "No shipment data found in DHL response"}

            # If multiple shipments are returned for a single tracking number, it's an MPS
            # Alternatively, if there's only one but it references multiple pieces, we handle that.
            
            main_shipment = shipments[0]
            data = self._extract_piece_data(main_shipment)
            
            child_parcels = []
            is_master = False
            master_tracking_number = None

            # DHL Unified API returns all related shipments in the 'shipments' array
            # if the tracking number is a master or if they are linked.
            if len(shipments) > 1:
                is_master = True
                for i, s in enumerate(shipments):
                    s_tn = s.get("id") or s.get("trackingNumber")
                    if s_tn == tracking_number:
                        # This is the one we queried, it's the "master" for our purposes
                        continue
                    
                    p_data = self._extract_piece_data(s)
                    child_parcels.append({
                        "tracking_number": s_tn,
                        "status": p_data["status"],
                        "raw_status": p_data["raw_status"],
                        "origin": p_data["origin"],
                        "destination": p_data["destination"],
                        "eta": p_data["eta"],
                        "history": p_data.get("history", []),
                        "carrier": "DHL",
                    })
            
            # Check for explicit piece information if only one shipment entry but multiple pieces
            # Some DHL services return piece level details inside a single shipment object
            pieces = main_shipment.get("pieces", [])
            if not child_parcels and pieces:
                # If there are multiple pieces and we haven't already filled child_parcels
                if len(pieces) > 1:
                    is_master = True
                    for p in pieces:
                        p_tn = p.get("trackingNumber") or p.get("id")
                        if not p_tn or p_tn == tracking_number:
                            continue
                        
                        # Note: Piece objects might have less info than full Shipment objects
                        # We try to use piece info if available, otherwise fallback to master info
                        p_raw_status = p.get("status", {}).get("status") or data["raw_status"]
                        child_parcels.append({
                            "tracking_number": p_tn,
                            "status": map_dhl_status(p_raw_status),
                            "raw_status": p_raw_status,
                            "origin": data["origin"],
                            "destination": data["destination"],
                            "eta": data["eta"],
                            # Piece-level history is not always exposed by this response;
                            # fall back to the master timeline so the UI can show full flow.
                            "history": list(data.get("history", [])),
                            "carrier": "DHL",
                        })

            child_tracking_numbers = [p["tracking_number"] for p in child_parcels]

            return {
                "carrier": "DHL",
                **data,
                "is_master": is_master,
                "master_tracking_number": master_tracking_number,
                "child_parcels": child_parcels,
                "child_tracking_numbers": child_tracking_numbers,
            }

        except Exception as e:
            logger.error("Error parsing DHL response: %s", e)
            return {"error": f"Failed to parse DHL response: {str(e)}"}
