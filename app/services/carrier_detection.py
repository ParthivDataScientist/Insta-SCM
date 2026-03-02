import re


def detect_carrier(tracking_number: str) -> str:
    """
    Detect carrier based on tracking number format.
    Returns: "FedEx", "UPS", "DHL", or "Unknown"

    UPS tracking is detected but not yet supported in the service layer.
    """
    tn = tracking_number.strip().upper()

    # UPS — starts with 1Z, 18 chars
    if tn.startswith("1Z") and len(tn) == 18:
        return "UPS"

    # FedEx Express  — 12 digits
    # FedEx Ground   — 15 digits
    # FedEx Ground96 — 20 or 22 digits
    if re.fullmatch(r"\d{12}", tn):
        return "FedEx"
    if re.fullmatch(r"\d{15}", tn):
        return "FedEx"
    if re.fullmatch(r"\d{20}", tn):
        return "FedEx"
    if re.fullmatch(r"\d{22}", tn):
        return "FedEx"

    # DHL Express — 10 digits
    # Must come after FedEx checks to avoid false positives
    if re.fullmatch(r"\d{10}", tn):
        return "DHL"

    # DHL eCommerce — alphanumeric, often starts with GM, LX, RX
    if re.fullmatch(r"[A-Z]{2}\d{9,}[A-Z]{2}", tn):
        return "DHL"

    return "Unknown"
