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
    "clearance delay": "Exception",
    "delivery delay": "Exception",
    "delay": "Exception",
    "held": "Exception",
    "customs": "In Transit",
    "clearance": "In Transit",
    "delivery updated": "In Transit",
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
                raw_data = resp.json()

                # --- NEW CODE: MPS Check ---
                # Default associated payload
                associated_results = []
                
                # Check if this tracking number acts as a MASTER in any trackResult
                master_tn = None
                is_master = False
                try:
                    output = raw_data["output"]["completeTrackResults"][0]["trackResults"][0]
                    associated_shipments = output.get("associatedShipments", [])

                    # 1. Check associatedShipments array
                    for assoc in associated_shipments:
                        rel_type = assoc.get("type", "").upper()
                        if rel_type == "CHILD" or rel_type == "ASSOCIATED":
                            is_master = True
                            break
                        elif rel_type == "MASTER":
                            master_tn = assoc.get("trackingNumberInfo", {}).get("trackingNumber")

                    # 2. Check packageIdentifiers for STANDARD_MPS
                    if not is_master:
                        package_identifiers = output.get("additionalTrackingInfo", {}).get("packageIdentifiers", [])
                        for pkg in package_identifiers:
                            if pkg.get("type") == "STANDARD_MPS":
                                values = pkg.get("values", [])
                                if values:
                                    master_tn = values[0]
                                    if master_tn == tracking_number:
                                        is_master = True
                                break

                    # If this is a master, make a second request to get full child objects
                    if is_master:
                        assoc_url = f"{self.base_url}/track/v1/associatedshipments"
                        assoc_body = {
                            "masterTrackingNumberInfo": {
                                "trackingNumberInfo": {
                                    "trackingNumber": tracking_number
                                }
                            },
                            "associatedType": "STANDARD_MPS",
                            "includeDetailedScans": True
                        }
                        assoc_resp = requests.post(assoc_url, headers=headers, json=assoc_body, timeout=20)
                        
                        if assoc_resp.status_code == 200:
                            assoc_data = assoc_resp.json()
                            try:
                                associated_results = assoc_data["output"]["completeTrackResults"][0]["trackResults"]
                            except (KeyError, IndexError):
                                associated_results = []
                        else:
                            logger.warning(f"Failed to fetch associated shipments for MPS {tracking_number}: {assoc_resp.status_code}")
                except (KeyError, IndexError) as e:
                    logger.error(f"Error inspecting MPS raw data for {tracking_number}: {e}")

                return self._standardize_response(raw_data, tracking_number, associated_results, master_tn, is_master)
            else:
                logger.warning("FedEx API returned %d for %s", resp.status_code, tracking_number)
                return {"error": f"FedEx API Error: {resp.status_code} — {resp.text[:200]}"}
        except Exception as e:
            logger.error("FedEx request failed for %s: %s", tracking_number, e)
            return {"error": f"Request Failed: {str(e)}"}

    def _extract_piece_data(self, piece_output: Dict[str, Any]) -> Dict[str, Any]:
        """Helper to extract common fields from a single piece output (master or child)."""
        scan_events = piece_output.get("scanEvents", [])
        raw_status = piece_output.get("latestStatusDetail", {}).get("statusByLocale", "Unknown")
        mapped_status = map_fedex_status(raw_status)

        # Extract History
        history = []
        for event in scan_events:
            desc = event.get("eventDescription", "")
            city = event.get("scanLocation", {}).get("city", "")
            state = event.get("scanLocation", {}).get("stateOrProvinceCode", "")
            country = event.get("scanLocation", {}).get("countryCode", "")
            location = f"{city}, {state}, {country}".strip(", ")
            timestamp = event.get("date", "")

            raw_event_type = event.get("eventType", "")
            event_label = HISTORY_STATUS_MAP.get(raw_event_type, raw_event_type)

            history.append({
                "description": desc,
                "location": location,
                "status": event_label,
                "date": timestamp,
            })
        history.sort(key=lambda x: x["date"], reverse=True)

        # Use history description for display if raw status is generic
        if history and (raw_status.lower() in ["unknown", "delivery updated", "shipment exception", "clearance delay"]):
            raw_status = history[0]["description"]

        # Extract Origin
        origin = "Unknown"
        origin_loc = piece_output.get("originLocation", {}).get("locationContactAndAddress", {}).get("address", {})
        if not origin_loc:
            origin_loc = piece_output.get("shipperInformation", {}).get("address", {})
        if origin_loc and origin_loc.get("city"):
            origin = f"{origin_loc.get('city')}, {origin_loc.get('stateOrProvinceCode', '')}, {origin_loc.get('countryCode', '')}".strip(", ")
        elif history:
            for event in reversed(history):
                if event["location"].strip():
                    origin = event["location"]
                    break

        destination = "Unknown"
        dest_loc = piece_output.get("recipientInformation", {}).get("address", {})
        dest_country = dest_loc.get("countryCode", "")
        if dest_loc and dest_loc.get("city"):
            destination = f"{dest_loc.get('city')}, {dest_loc.get('stateOrProvinceCode', '')}, {dest_country}".strip(", ")
        elif "deliver" in raw_status.lower() and history:
            destination = history[0]["location"]

        # Extract ETA
        eta = "Unknown"
        date_times = piece_output.get("dateAndTimes", [])
        actual_delivery = next((dt.get("dateTime") for dt in date_times if dt.get("type") == "ACTUAL_DELIVERY"), None)
        if actual_delivery:
            eta = actual_delivery[:10]
        if eta == "Unknown":
            est_types = ("ESTIMATED_DELIVERY", "ESTIMATED_DELIVERY_COMMITMENT", "ESTIMATED_ARRIVAL_AT_DESTINATION")
            estimated_delivery = next((dt.get("dateTime") for dt in date_times if dt.get("type") in est_types), None)
            if estimated_delivery:
                eta = estimated_delivery[:10]
        if eta == "Unknown":
            comm_types = ("COMMITMENT", "ESTIMATED_STANDARD_TRANSIT", "APPOINTMENT")
            commitment = next((dt.get("dateTime") for dt in date_times if dt.get("type") in comm_types), None)
            if commitment:
                eta = commitment[:10]
        if eta == "Unknown":
            window = piece_output.get("estimatedDeliveryTimeWindow", {}).get("window", {})
            if window.get("ends"):
                eta = window["ends"][:10]
            elif window.get("begins"):
                eta = window["begins"][:10]

        # Calculate Progress
        progress_map = {
            "Delivered": 100,
            "Out for Delivery": 85,
            "In Transit": 30,
            "Exception": 10,
        }
        progress = progress_map.get(mapped_status, 0)
        
        # Smart progress for In Transit
        if mapped_status == "In Transit" and history:
            current_country = history[0].get("location", "").split(",")[-1].strip()
            if dest_country and current_country == dest_country:
                progress = 60  # Reached destination country
            elif len(history) > 2:
                progress = 45  # Documented movement
            else:
                progress = 25  # Just started

        last_date = ""
        last_location = ""
        if history:
            last_date = history[0].get("date", "")
            last_location = history[0].get("location", "")
        
        # Fallback for location if history is empty
        if not last_location:
            loc_detail = piece_output.get("latestStatusDetail", {}).get("scanLocation", {})
            if loc_detail:
                c = loc_detail.get("city", "")
                s = loc_detail.get("stateOrProvinceCode", "")
                cy = loc_detail.get("countryCode", "")
                last_location = f"{c}, {s}, {cy}".strip(", ")

        return {
            "status": mapped_status,
            "raw_status": raw_status,
            "origin": origin,
            "destination": destination,
            "eta": eta,
            "progress": progress,
            "history": history,
            "last_date": last_date,
            "last_location": last_location,
        }

    def _standardize_response(self, raw_data: Dict, tracking_number: str, associated_results: list = None, master_tn: str = None, is_master: bool = False) -> Dict[str, Any]:
        if associated_results is None:
            associated_results = []
        
        try:
            output = raw_data["output"]["completeTrackResults"][0]["trackResults"][0]
            master_data = self._extract_piece_data(output)
            # Extract MPS / Associated Shipments
            associated_shipments = output.get("associatedShipments", [])
            child_parcels: list = []
            master_tracking_number = master_tn

            if associated_results:
                is_master = True
                for c_res in associated_results:
                    c_tn = c_res.get("trackingNumberInfo", {}).get("trackingNumber")
                    if not c_tn or c_tn == tracking_number:
                        continue
                    
                    # Extract full details for child parcel
                    child_data = self._extract_piece_data(c_res)
                    child_parcels.append({
                        "tracking_number": c_tn,
                        "status": child_data["status"],
                        "raw_status": child_data["raw_status"],
                        "origin": child_data["origin"],
                        "destination": child_data["destination"],
                        "eta": child_data["eta"],
                        "last_date": child_data["last_date"],
                        "last_location": child_data["last_location"],
                        "carrier": "FedEx",
                    })
            else:
                for assoc in associated_shipments:
                    rel_type = assoc.get("type", "").upper()
                    tn = assoc.get("trackingNumberInfo", {}).get("trackingNumber")
                    if not tn:
                        continue

                    if rel_type in ("CHILD", "ASSOCIATED", "ASSOCIATED_SHIPMENT"):
                        child_data = self._extract_piece_data(assoc)
                        child_parcels.append({
                            "tracking_number": tn,
                            "status": child_data["status"],
                            "raw_status": child_data["raw_status"],
                            "origin": child_data["origin"],
                            "destination": child_data["destination"],
                            "eta": child_data["eta"],
                            "last_date": child_data["last_date"],
                            "last_location": child_data["last_location"],
                            "carrier": "FedEx",
                        })
                        is_master = True
                    elif rel_type == "MASTER":
                        if not master_tracking_number:
                            master_tracking_number = tn

            # Backward-compat: flat list of tracking numbers
            child_tracking_numbers = [p["tracking_number"] for p in child_parcels]

            return {
                "carrier": "FedEx",
                **master_data,
                "master_tracking_number": master_tracking_number,
                "is_master": is_master,
                "child_parcels": child_parcels,
                "child_tracking_numbers": child_tracking_numbers,
            }
   

        except (KeyError, IndexError) as e:
            logger.error("Error parsing FedEx response: %s", e)
            return {"error": f"Failed to parse FedEx response: {str(e)}"}