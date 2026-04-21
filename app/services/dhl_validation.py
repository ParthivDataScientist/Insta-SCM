from __future__ import annotations

import re

DHL_AWB_PATTERN = re.compile(r"^\d{10}$")
DHL_ECOMMERCE_PATTERN = re.compile(r"^[A-Z]{2}\d{9,}[A-Z]{2}$")
DHL_CHILD_PIECE_PATTERN = re.compile(r"^JD\d{10,}$")
DHL_AWB_FORMAT_ERROR = (
    "Invalid DHL tracking number format. Use a valid DHL AWB or child piece ID."
)


def sanitize_dhl_awb(awb: str) -> str:
    """
    Normalize common spreadsheet artifacts for DHL tracking identifiers.
    """
    value = str(awb or "").strip().upper()
    if value.endswith(".0") and value[:-2].isdigit():
        value = value[:-2]
    return value


def is_valid_dhl_tracking_number(awb: str, *, allow_child_piece: bool = True) -> bool:
    normalized = sanitize_dhl_awb(awb)
    if DHL_AWB_PATTERN.fullmatch(normalized):
        return True
    if DHL_ECOMMERCE_PATTERN.fullmatch(normalized):
        return True
    if allow_child_piece and DHL_CHILD_PIECE_PATTERN.fullmatch(normalized):
        return True
    return False


def is_dhl_child_piece_id(awb: str) -> bool:
    return bool(DHL_CHILD_PIECE_PATTERN.fullmatch(sanitize_dhl_awb(awb)))


def is_valid_dhl_awb(awb: str) -> bool:
    return is_valid_dhl_tracking_number(awb)

