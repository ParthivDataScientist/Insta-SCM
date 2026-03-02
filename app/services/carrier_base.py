from abc import ABC, abstractmethod
from typing import Dict, Any


# Shared event type code → human-readable label mapping.
# Imported by both FedExService and DHLService to avoid duplication (DRY).
HISTORY_STATUS_MAP: Dict[str, str] = {
    "PU": "Picked Up",
    "DP": "Departed",
    "AR": "Arrived",
    "DL": "Delivered",
    "OC": "Order Created",
    "SH": "Shipped",
    "IT": "In Transit",
    "HL": "Held",
    "EX": "Exception",
    "OF": "Out for Delivery",
    "CC": "Customs Cleared",
    "CI": "Customs Inspection",
    "SP": "Shipment Picked Up",
}


class CarrierService(ABC):
    @abstractmethod
    def track(self, tracking_number: str) -> Dict[str, Any]:
        """
        Track a shipment given a tracking number.
        Returns a standardized dict with at least 'status', 'history'.
        On failure, returns a dict with an 'error' key.
        """
        pass
