from __future__ import annotations

import re

DHL_AWB_PATTERN = re.compile(r"^\d{10}$")
DHL_AWB_FORMAT_ERROR = "Invalid Format: DHL Tracking Numbers Only"


def sanitize_dhl_awb(awb: str) -> str:
    """
    Normalize common spreadsheet artifacts while keeping strict numeric validation.
    """
    value = str(awb or "").strip()
    if value.endswith(".0") and value[:-2].isdigit():
        value = value[:-2]
    return value


def is_valid_dhl_awb(awb: str) -> bool:
    return bool(DHL_AWB_PATTERN.fullmatch(sanitize_dhl_awb(awb)))

