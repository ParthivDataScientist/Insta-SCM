from typing import Optional

DHL_STATUS_MAP = {
    "delivered": "Delivered",
    "delivery successful": "Delivered",
    "shipment delivered": "Delivered",
    "delivered - signed for": "Delivered",
    "proof of delivery": "Delivered",
    "transit": "In Transit",
    "in transit": "In Transit",
    "departed": "In Transit",
    "arrived": "In Transit",
    "processed": "In Transit",
    "sorted": "In Transit",
    "picked up": "In Transit",
    "shipment picked up": "In Transit",
    "customs update": "In Transit",
    "customs clearance status updated": "In Transit",
    "customs cleared": "In Transit",
    "out for delivery": "Out for Delivery",
    "with delivery courier": "Out for Delivery",
    "with courier": "Out for Delivery",
    "exception": "Exception",
    "held": "Exception",
    "customs hold": "Exception",
    "held at customs": "Exception",
    "customs delay": "Exception",
    "delay": "Exception",
    "returned": "Exception",
    "undeliver": "Exception",
    "attempted": "Exception",
}


def map_dhl_status(status_str: str, event_code: Optional[str] = None) -> str:
    lower = str(status_str or "").lower().strip()
    code = str(event_code or "").upper().strip()

    if code == "WC":
        return "Out for Delivery"
    if code == "OK":
        return "Delivered"

    if lower in DHL_STATUS_MAP:
        return DHL_STATUS_MAP[lower]

    for key in sorted(DHL_STATUS_MAP, key=len, reverse=True):
        if key in lower:
            return DHL_STATUS_MAP[key]

    delivered_markers = (
        "shipment delivered",
        "delivery successful",
        "delivered - signed for",
        "proof of delivery",
        "delivered",
    )
    if any(marker in lower for marker in delivered_markers):
        if not any(token in lower for token in ("delivery facility", "out for delivery", "scheduled for delivery", "attempted")):
            return "Delivered"

    return "In Transit"
