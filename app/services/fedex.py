import requests
import json
import time
import logging
from .carrier_base import CarrierService, HISTORY_STATUS_MAP
from app.core.config import settings
from typing import Dict, Any

logger = logging.getLogger(__name__)

# Map raw FedEx status strings to dashboard categories
FEDEX_STATUS_MAP = {
    # Delivered
    "delivered": "Delivered",
    "delivery": "Delivered",
    # In Transit
    "in transit": "In Transit",
    "departed": "In Transit",
    "arrived at": "In Transit",
    "left fedex": "In Transit",
    "in fedex": "In Transit",
    "picked up": "In Transit",
    "shipment information sent": "In Transit",
    "on fedex vehicle": "Out for Delivery",
    "out for delivery": "Out for Delivery",
    "at local fedex": "Out for Delivery",
    # Exception / Hold
    "exception": "Exception",
    "delay": "Exception",
    "held": "Exception",
    "customs": "Exception",
    "clearance": "Exception",
    "delivery updated": "Exception",
    # Ready for pickup
    "ready for pickup": "Out for Delivery",
    "ready to pick up": "Out for Delivery",
    "available for pickup": "Out for Delivery",
    "at pickup point": "Out for Delivery",
}

# Module-level token cache to avoid re-authenticating on every request
_fedex_token: str = ""
_fedex_token_expiry: float = 0.0


def map_fedex_status(raw_status: str) -> str:
    """Map a raw FedEx status string to our dashboard status categories."""
    lower = raw_status.lower().strip()

    # Direct match first
    if lower in FEDEX_STATUS_MAP:
        return FEDEX_STATUS_MAP[lower]

    # Partial match — sorted by key length (longest first) for specificity
    for key in sorted(FEDEX_STATUS_MAP.keys(), key=len, reverse=True):
        if key in lower:
            return FEDEX_STATUS_MAP[key]

    # Fallback: if "deliver" is anywhere in the string, it's delivered
    if "deliver" in lower:
        return "Delivered"

    # Default to In Transit for unknown statuses
    return "In Transit"


class FedExService(CarrierService):
    def __init__(self):
        self.base_url = settings.FEDEX_URL
        self.client_id = settings.FEDEX_CLIENT_ID
        self.client_secret = settings.FEDEX_CLIENT_SECRET

    def _get_token(self) -> str:
        """Fetch a new OAuth token. Caches at module level for ~1 hour."""
        global _fedex_token, _fedex_token_expiry

        # Return cached token if still valid (with 60s buffer)
        if _fedex_token and time.time() < _fedex_token_expiry - 60:
            return _fedex_token

        auth_url = f"{self.base_url}/oauth/token"
        payload = {
            "grant_type": "client_credentials",
            "client_id": self.client_id,
            "client_secret": self.client_secret,
        }
        try:
            resp = requests.post(auth_url, data=payload, timeout=10)
            resp.raise_for_status()
            data = resp.json()
            _fedex_token = data["access_token"]
            # FedEx tokens are valid for ~3600 seconds
            _fedex_token_expiry = time.time() + data.get("expires_in", 3600)
            logger.info("FedEx token refreshed; expires in %ds", data.get("expires_in", 3600))
            return _fedex_token
        except Exception as e:
            logger.error("FedEx Auth Failed: %s", e)
            raise

    def track(self, tracking_number: str) -> Dict[str, Any]:
        try:
            token = self._get_token()
        except Exception as e:
            return {"error": f"FedEx authentication failed: {str(e)}"}

        track_url = f"{self.base_url}/track/v1/trackingnumbers"
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        }
        body = {
            "trackingInfo": [
                {"trackingNumberInfo": {"trackingNumber": tracking_number}}
            ],
            "includeDetailedScans": True,
        }

        try:
            resp = requests.post(track_url, headers=headers, json=body, timeout=15)
            if resp.status_code == 200:
                return self._standardize_response(resp.json())
            else:
                logger.warning("FedEx API returned %d for %s", resp.status_code, tracking_number)
                return {"error": f"FedEx API Error: {resp.status_code} — {resp.text[:200]}"}
        except Exception as e:
            logger.error("FedEx request failed for %s: %s", tracking_number, e)
            return {"error": f"Request Failed: {str(e)}"}

    def _standardize_response(self, raw_data: Dict) -> Dict[str, Any]:
        try:
            output = raw_data["output"]["completeTrackResults"][0]["trackResults"][0]
            scan_events = output.get("scanEvents", [])
            raw_status = output.get("latestStatusDetail", {}).get("statusByLocale", "Unknown")

            # Extract Events (History)
            history = []
            for event in scan_events:
                desc = event.get("eventDescription", "")
                city = event.get("scanLocation", {}).get("city", "")
                state = event.get("scanLocation", {}).get("stateOrProvinceCode", "")
                location = f"{city}, {state}".strip(", ")
                timestamp = event.get("date", "")

                raw_event_type = event.get("eventType", "")
                event_label = HISTORY_STATUS_MAP.get(raw_event_type, raw_event_type)

                history.append({
                    "description": desc,
                    "location": location,
                    "status": event_label,
                    "date": timestamp,
                })

            # Sort history by date descending (newest first)
            history.sort(key=lambda x: x["date"], reverse=True)

            # Extract Origin
            origin = "Unknown"
            origin_loc = output.get("originLocation", {}).get("locationContactAndAddress", {}).get("address", {})
            if not origin_loc:
                origin_loc = output.get("shipperInformation", {}).get("address", {})
            if origin_loc and origin_loc.get("city"):
                origin = f"{origin_loc.get('city')}, {origin_loc.get('stateOrProvinceCode', '')}".strip(", ")
            elif history:
                for event in reversed(history):
                    if event["location"].strip():
                        origin = event["location"]
                        break

            # Extract Destination
            destination = "Unknown"
            dest_loc = output.get("recipientInformation", {}).get("address", {})
            if dest_loc and dest_loc.get("city"):
                destination = f"{dest_loc.get('city')}, {dest_loc.get('stateOrProvinceCode', '')}".strip(", ")
            elif "deliver" in raw_status.lower() and history:
                destination = history[0]["location"]

            # Extract ETA
            eta = "Unknown"
            date_times = output.get("dateAndTimes", [])

            actual_delivery = next(
                (dt.get("dateTime") for dt in date_times if dt.get("type") == "ACTUAL_DELIVERY"), None
            )
            if actual_delivery:
                eta = actual_delivery[:10]

            if eta == "Unknown":
                estimated_delivery = next(
                    (dt.get("dateTime") for dt in date_times if dt.get("type") == "ESTIMATED_DELIVERY"), None
                )
                if estimated_delivery:
                    eta = estimated_delivery[:10]

            if eta == "Unknown":
                window = output.get("estimatedDeliveryTimeWindow", {}).get("window", {})
                if window.get("ends"):
                    eta = window["ends"][:10]
                elif window.get("begins"):
                    eta = window["begins"][:10]

            # Calculate Progress
            mapped_status = map_fedex_status(raw_status)
            progress_map = {
                "Delivered": 100,
                "Out for Delivery": 80,
                "In Transit": 40,
                "Exception": 10,
            }
            progress = progress_map.get(mapped_status, 0)

            # Extract MPS / Associated Shipments
            # Each child parcel gets its own status object so we can show
            # per-box statuses in the UI — not just bare tracking numbers.
            associated_shipments = output.get("associatedShipments", [])
            child_parcels: list = []          # [{tracking_number, status, raw_status}]
            master_tracking_number = None
            is_master = False

            for assoc in associated_shipments:
                rel_type = assoc.get("type", "").upper()
                tn = assoc.get("trackingNumberInfo", {}).get("trackingNumber")
                if not tn:
                    continue

                if rel_type in ("CHILD", "ASSOCIATED", "ASSOCIATED_SHIPMENT"):
                    # Pull the child's own latest status if FedEx returns it
                    child_raw_status = (
                        assoc.get("latestStatusDetail", {})
                             .get("statusByLocale", "")
                    )
                    child_status = (
                        map_fedex_status(child_raw_status)
                        if child_raw_status
                        else "Unknown"
                    )
                    child_parcels.append({
                        "tracking_number": tn,
                        "status": child_status,
                        "raw_status": child_raw_status,
                    })
                    is_master = True

                elif rel_type == "MASTER":
                    master_tracking_number = tn

            # Backward-compat: flat list of tracking numbers
            child_tracking_numbers = [p["tracking_number"] for p in child_parcels]

            return {
                "carrier": "FedEx",
                "status": mapped_status,
                "raw_status": raw_status,
                "origin": origin,
                "destination": destination,
                "eta": eta,
                "progress": progress,
                "history": history,
                "master_tracking_number": master_tracking_number,
                "is_master": is_master,
                "child_parcels": child_parcels,
                # Keep old key for any callers that haven't migrated yet
                "child_tracking_numbers": child_tracking_numbers,
            }

        except (KeyError, IndexError) as e:
            logger.error("Error parsing FedEx response: %s", e)
            return {"error": f"Failed to parse FedEx response: {str(e)}"}