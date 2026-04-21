"""Heuristic identification of logistics provider from tracking identifier patterns.

Why heuristics instead of a single regex: providers overlap numeric formats; order of
checks matters to minimize false positives when classifying inbound tracking strings.
"""

from __future__ import annotations

import re

from app.services.dhl_validation import is_valid_dhl_tracking_number

# Public label returned to API consumers (stable contract).
ProviderName = str


def detect_carrier(tracking_number: str) -> ProviderName:
    """Infer the logistics provider from the shape of ``tracking_number``.

    Args:
        tracking_number: Raw identifier as entered by a user or external system.

    Returns:
        One of ``"FedEx"``, ``"UPS"``, ``"DHL"``, or ``"Unknown"``.

    Why:
        Downstream routing selects the correct adapter; unknown values defer to manual
        handling rather than guessing incorrectly.
    """
    tn = tracking_number.strip().upper()

    if tn.startswith("1Z") and len(tn) == 18:
        return "UPS"

    if re.fullmatch(r"\d{12}", tn):
        return "FedEx"
    if re.fullmatch(r"\d{15}", tn):
        return "FedEx"
    if re.fullmatch(r"\d{20}", tn):
        return "FedEx"
    if re.fullmatch(r"\d{22}", tn):
        return "FedEx"

    if is_valid_dhl_tracking_number(tn):
        return "DHL"

    return "Unknown"
