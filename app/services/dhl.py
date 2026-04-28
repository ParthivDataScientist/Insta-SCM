import logging
from typing import Any, Dict

from .carrier_base import CarrierService, HISTORY_STATUS_MAP
from .dhl_provider import DHLProvider
from .dhl_status import map_dhl_status
from .dhl_validation import sanitize_dhl_awb

logger = logging.getLogger(__name__)


def _normalize_dhl_tracking_number(tracking_number: str) -> str:
    """
    Normalize DHL tracking numbers from import flows.
    Common issue: Excel numeric cells become values like `1234567890.0`.
    """
    return sanitize_dhl_awb(tracking_number)


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

        status_obj = shipment.get("status", {})
        raw_status = status_obj.get("status", "Unknown")
        shipment_status = map_dhl_status(raw_status)

        origin_obj = shipment.get("origin", {}).get("address", {})
        origin = f"{origin_obj.get('addressLocality', '')}, {origin_obj.get('countryCode', '')}".strip(", ")
        if not origin and events:
            last_event = events[-1]
            location_obj = last_event.get("location", {}).get("address", {})
            origin = f"{location_obj.get('addressLocality', '')}, {location_obj.get('countryCode', '')}".strip(", ")

        destination_obj = shipment.get("destination", {}).get("address", {})
        destination = f"{destination_obj.get('addressLocality', '')}, {destination_obj.get('countryCode', '')}".strip(", ")

        eta = shipment.get("estimatedDeliveryDate", "Unknown")
        if eta != "Unknown":
            eta = eta.split("T")[0] if "T" in eta else eta[:10]

        history = []
        for event in events:
            description = event.get("description", "")
            location_obj = event.get("location", {}).get("address", {})
            location = f"{location_obj.get('addressLocality', '')}, {location_obj.get('countryCode', '')}".strip(", ")

            timestamp = event.get("timestamp")
            if not timestamp:
                timestamp = (event.get("date", "") + " " + event.get("time", "")).strip()

            type_code = event.get("typeCode", "")
            event_status = HISTORY_STATUS_MAP.get(type_code, type_code)

            history.append({
                "description": description,
                "location": location,
                "status": event_status,
                "date": timestamp,
            })

        history.sort(key=lambda item: item["date"], reverse=True)

        progress_map = {
            "Delivered": 100,
            "Out for Delivery": 80,
            "In Transit": 40,
            "Exception": 10,
        }
        progress = progress_map.get(shipment_status, 0)

        last_date = ""
        last_location = ""
        if history:
            last_date = history[0].get("date", "")
            last_location = history[0].get("location", "")

        return {
            "status": shipment_status,
            "raw_status": raw_status,
            "origin": origin,
            "destination": destination,
            "eta": eta,
            "progress": progress,
            "history": history,
            "last_date": last_date,
            "last_location": last_location,
        }

    def _standardize_response(self, raw_data: Dict, tracking_number: str) -> Dict[str, Any]:
        try:
            shipments = raw_data.get("shipments", [])
            if not shipments:
                return {"error": "No shipment data found in DHL response"}

            main_shipment = shipments[0]
            data = self._extract_piece_data(main_shipment)

            child_parcels = []
            is_master = False
            master_tracking_number = None

            if len(shipments) > 1:
                is_master = True
                for related_shipment in shipments:
                    related_tracking_number = related_shipment.get("id") or related_shipment.get("trackingNumber")
                    if related_tracking_number == tracking_number:
                        continue

                    piece_data = self._extract_piece_data(related_shipment)
                    child_parcels.append({
                        "tracking_number": related_tracking_number,
                        "status": piece_data["status"],
                        "raw_status": piece_data["raw_status"],
                        "origin": piece_data["origin"],
                        "destination": piece_data["destination"],
                        "eta": piece_data["eta"],
                        "last_date": piece_data.get("last_date", ""),
                        "last_location": piece_data.get("last_location", ""),
                        "history": piece_data.get("history", []),
                        "carrier": "DHL",
                    })

            pieces = main_shipment.get("pieces", [])
            if not child_parcels and len(pieces) > 1:
                is_master = True
                for piece in pieces:
                    piece_tracking_number = piece.get("trackingNumber") or piece.get("id")
                    if not piece_tracking_number or piece_tracking_number == tracking_number:
                        continue

                    piece_raw_status = piece.get("status", {}).get("status") or data["raw_status"]
                    child_parcels.append({
                        "tracking_number": piece_tracking_number,
                        "status": map_dhl_status(piece_raw_status),
                        "raw_status": piece_raw_status,
                        "origin": data["origin"],
                        "destination": data["destination"],
                        "eta": data["eta"],
                        "last_date": data.get("last_date", ""),
                        "last_location": data.get("last_location", ""),
                        "history": list(data.get("history", [])),
                        "carrier": "DHL",
                    })

            child_tracking_numbers = [parcel["tracking_number"] for parcel in child_parcels]

            return {
                "carrier": "DHL",
                **data,
                "is_master": is_master,
                "master_tracking_number": master_tracking_number,
                "child_parcels": child_parcels,
                "child_tracking_numbers": child_tracking_numbers,
            }

        except Exception as error:
            logger.error("Error parsing DHL response: %s", error)
            return {"error": f"Failed to parse DHL response: {str(error)}"}
