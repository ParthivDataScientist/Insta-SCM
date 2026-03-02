import requests
import logging
from typing import Dict, Any
from .carrier_base import CarrierService, HISTORY_STATUS_MAP
from app.core.config import settings

logger = logging.getLogger(__name__)

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

    if "deliver" in lower and "out" not in lower:
        return "Delivered"

    return "In Transit"


class DHLService(CarrierService):
    def __init__(self):
        self.base_url = "https://api-eu.dhl.com/express/v1"
        self.api_key = settings.DHL_API_KEY
        self.api_secret = settings.DHL_API_SECRET

    def track(self, tracking_number: str) -> Dict[str, Any]:
        """Track a shipment using DHL Express API."""
        track_url = f"{self.base_url}/shipments"
        params = {"trackingNumber": tracking_number, "language": "en"}

        try:
            response = requests.get(
                track_url,
                params=params,
                auth=(self.api_key, self.api_secret),
                timeout=10,
            )

            if response.status_code == 200:
                return self._standardize_response(response.json())
            elif response.status_code == 404:
                return {"carrier": "DHL", "error": "Shipment not found"}
            else:
                logger.warning("DHL API returned %d for %s", response.status_code, tracking_number)
                return {"carrier": "DHL", "error": f"DHL API Error: {response.status_code}"}
        except Exception as e:
            logger.error("DHL request failed for %s: %s", tracking_number, e)
            return {"error": f"DHL Request Failed: {str(e)}"}

    def _standardize_response(self, raw_data: Dict) -> Dict[str, Any]:
        try:
            shipments = raw_data.get("shipments", [])
            if not shipments:
                return {"error": "No shipment data found in DHL response"}

            shipment = shipments[0]
            events = shipment.get("events", [])

            # --- Status (shipment-level) ---
            status_obj = shipment.get("status", {})
            raw_status = status_obj.get("status", "Unknown")
            shipment_status = map_dhl_status(raw_status)  # renamed: was mapped_status (caused shadowing)

            # --- Origin & Destination ---
            origin_obj = shipment.get("origin", {}).get("address", {})
            origin = f"{origin_obj.get('addressLocality', '')}, {origin_obj.get('countryCode', '')}".strip(", ")

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
                timestamp = (event.get("date", "") + " " + event.get("time", "")).strip()

                raw_type_code = event.get("typeCode", "")
                # Use a distinct variable name to avoid shadowing the shipment-level status
                event_type_label = HISTORY_STATUS_MAP.get(raw_type_code, raw_type_code)

                history.append({
                    "description": desc,
                    "location": loc,
                    "status": event_type_label,
                    "date": timestamp,
                })

            # --- Progress (uses shipment_status, NOT the last event's type) ---
            progress_map = {
                "Delivered": 100,
                "Out for Delivery": 80,
                "In Transit": 40,
                "Exception": 10,
            }
            progress = progress_map.get(shipment_status, 0)

            return {
                "carrier": "DHL",
                "status": shipment_status,
                "raw_status": raw_status,
                "origin": origin,
                "destination": destination,
                "eta": eta,
                "progress": progress,
                "history": history,
            }

        except Exception as e:
            logger.error("Error parsing DHL response: %s", e)
            return {"error": f"Failed to parse DHL response: {str(e)}"}