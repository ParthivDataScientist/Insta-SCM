import requests
import json
import time
import logging
from .carrier_base import CarrierService, HISTORY_STATUS_MAP
from app.core.config import settings
from typing import Dict, Any, List, Optional

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
    "delay — clearance in progress": "Exception",
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


def _normalize_fedex_tracking_number(tracking_number: str) -> str:
    """
    Normalize tracking numbers coming from Excel/import flows.
    Common issue: numeric cells become strings like `123456789012.0`.
    """
    tn = str(tracking_number or "").strip()
    if tn.endswith(".0") and tn[:-2].isdigit():
        tn = tn[:-2]
    return "".join(ch for ch in tn if ch.isalnum())


def map_fedex_status(raw_status: str) -> str:
    """Map a raw FedEx status string to our dashboard status categories."""
    lower = raw_status.lower().strip()

    # High-priority exception keywords
    if any(k in lower for k in ["delay", "exception", "held"]):
        return "Exception"

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

    def _extract_tracking_number(self, payload: Dict[str, Any]) -> Optional[str]:
        if not isinstance(payload, dict):
            return None
        return (
            payload.get("trackingNumberInfo", {}).get("trackingNumber")
            or payload.get("trackingNumber")
            or payload.get("tracking_number")
        )

    def _extract_track_results(self, payload: Any) -> List[Dict[str, Any]]:
        """
        FedEx MPS responses can nest piece results in a few different places.
        Walk the payload recursively and collect any dict that looks like a
        track result so child parcels are not lost when the shape varies.
        """
        collected: List[Dict[str, Any]] = []
        seen: set[str] = set()

        def visit(node: Any) -> None:
            if isinstance(node, dict):
                tracking_number = self._extract_tracking_number(node)
                if tracking_number and (
                    "latestStatusDetail" in node
                    or "scanEvents" in node
                    or "dateAndTimes" in node
                    or "associatedShipments" in node
                ):
                    if tracking_number not in seen:
                        seen.add(tracking_number)
                        collected.append(node)
                for value in node.values():
                    visit(value)
            elif isinstance(node, list):
                for item in node:
                    visit(item)

        visit(payload)
        return collected

    def _build_child_parcel(self, piece: Dict[str, Any], tracking_number: str) -> Dict[str, Any]:
        child_data = self._extract_piece_data(piece)
        return {
            "tracking_number": tracking_number,
            "status": child_data["status"],
            "raw_status": child_data["raw_status"],
            "origin": child_data["origin"],
            "destination": child_data["destination"],
            "eta": child_data["eta"],
            "last_date": child_data["last_date"],
            "last_location": child_data["last_location"],
            "carrier": "FedEx",
        }

    def _request_track(self, url: str, headers: Dict[str, str], body: Dict[str, Any], timeout: int = 15) -> Optional[Dict[str, Any]]:
        response = requests.post(url, headers=headers, json=body, timeout=timeout)
        if response.status_code != 200:
            logger.warning("FedEx API returned %d for body %s", response.status_code, json.dumps(body)[:200])
            return None
        return response.json()

    def _track_with_mps_variants(self, track_url: str, headers: Dict[str, str], tracking_number: str) -> Optional[Dict[str, Any]]:
        """
        Inference from FedEx docs: MPS tracking requires the master number with
        STANDARD_MPS. We try a small set of request variants and keep the first
        one that actually returns child parcels.
        """
        variant_bodies = [
            {
                "trackingInfo": [
                    {
                        "trackingNumberInfo": {"trackingNumber": tracking_number},
                        "associatedType": "STANDARD_MPS",
                    }
                ],
                "includeDetailedScans": True,
            },
            {
                "trackingInfo": [
                    {
                        "trackingNumberInfo": {"trackingNumber": tracking_number},
                        "packageIdentifier": {
                            "type": "STANDARD_MPS",
                            "value": tracking_number,
                        },
                    }
                ],
                "includeDetailedScans": True,
            },
        ]

        for body in variant_bodies:
            raw_data = self._request_track(track_url, headers, body)
            if not raw_data:
                continue
            parsed = self._standardize_response(raw_data, tracking_number)
            if parsed.get("child_parcels"):
                return parsed
        return None

    def track(self, tracking_number: str) -> Dict[str, Any]:
        normalized_tracking_number = _normalize_fedex_tracking_number(tracking_number)
        if normalized_tracking_number != tracking_number:
            logger.info(
                "Normalized FedEx tracking number from '%s' to '%s'",
                tracking_number,
                normalized_tracking_number,
            )

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
                {"trackingNumberInfo": {"trackingNumber": normalized_tracking_number}}
            ],
            "includeDetailedScans": True,
        }

        try:
            raw_data = self._request_track(track_url, headers, body, timeout=15)
            if raw_data:

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
                        assoc_tn = self._extract_tracking_number(assoc)
                        if rel_type in ("CHILD", "ASSOCIATED", "ASSOCIATED_SHIPMENT", "PIECE"):
                            is_master = True
                            break
                        if assoc_tn and assoc_tn != normalized_tracking_number:
                            is_master = True
                            break
                        elif rel_type == "MASTER":
                            master_tn = assoc_tn

                    # 2. Check packageIdentifiers for STANDARD_MPS
                    if not is_master:
                        package_identifiers = output.get("additionalTrackingInfo", {}).get("packageIdentifiers", [])
                        for pkg in package_identifiers:
                            if pkg.get("type") == "STANDARD_MPS":
                                values = pkg.get("values", [])
                                if values:
                                    master_tn = values[0]
                                    if normalized_tracking_number in values or master_tn == normalized_tracking_number:
                                        is_master = True
                                break

                    # If this is a master, make a second request to get full child objects
                    if is_master:
                        assoc_url = f"{self.base_url}/track/v1/associatedshipments"
                        assoc_body = {
                            "masterTrackingNumberInfo": {
                                "trackingNumber": normalized_tracking_number
                            },
                            "associatedType": "STANDARD_MPS",
                            "associatedReturnReferenceIndicator": "false",
                            "includeDetailedScans": True
                        }
                        assoc_resp = requests.post(assoc_url, headers=headers, json=assoc_body, timeout=20)
                        
                        if assoc_resp.status_code == 200:
                            assoc_data = assoc_resp.json()
                            associated_results = assoc_data.get("output", {}).get("completeTrackResults", [])
                            if not associated_results:
                                associated_results = self._extract_track_results(assoc_data)
                        else:
                            logger.warning(f"Failed to fetch associated shipments for MPS {normalized_tracking_number}: {assoc_resp.status_code}")

                    if not associated_results and associated_shipments:
                        associated_results = associated_shipments
                except (KeyError, IndexError) as e:
                    logger.error(f"Error inspecting MPS raw data for {normalized_tracking_number}: {e}")

                parsed = self._standardize_response(raw_data, normalized_tracking_number, associated_results, master_tn, is_master)
                if parsed.get("is_master") and not parsed.get("child_parcels"):
                    inferred_mps_result = self._track_with_mps_variants(track_url, headers, normalized_tracking_number)
                    if inferred_mps_result and inferred_mps_result.get("child_parcels"):
                        return inferred_mps_result
                return parsed
            else:
                logger.warning("FedEx tracking request failed for %s", normalized_tracking_number)
                return {"error": "FedEx API Error: tracking request failed."}
        except Exception as e:
            logger.error("FedEx request failed for %s: %s", normalized_tracking_number, e)
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
            seen_children: set[str] = set()

            def append_child(piece: Dict[str, Any], fallback_tracking_number: Optional[str] = None) -> None:
                track_results = piece.get("trackResults", []) if isinstance(piece, dict) else []
                piece_output = track_results[0] if track_results else piece
                child_tracking_number = (
                    self._extract_tracking_number(piece)
                    or self._extract_tracking_number(piece_output)
                    or fallback_tracking_number
                )
                if not child_tracking_number or child_tracking_number == tracking_number or child_tracking_number in seen_children:
                    return
                seen_children.add(child_tracking_number)
                child_parcels.append(self._build_child_parcel(piece_output, child_tracking_number))

            if associated_results:
                is_master = True
                for c_res in associated_results:
                    append_child(c_res)
            else:
                for assoc in associated_shipments:
                    rel_type = assoc.get("type", "").upper()
                    tn = self._extract_tracking_number(assoc)
                    if not tn:
                        continue

                    if rel_type in ("CHILD", "ASSOCIATED", "ASSOCIATED_SHIPMENT", "PIECE") or tn != tracking_number:
                        append_child(assoc, tn)
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
