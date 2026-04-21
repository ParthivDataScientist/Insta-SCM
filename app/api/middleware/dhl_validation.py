from __future__ import annotations

from fastapi import HTTPException

from app.services.dhl_validation import (
    DHL_AWB_FORMAT_ERROR,
    is_valid_dhl_tracking_number,
    sanitize_dhl_awb,
)


def validate_dhl_awb_or_400(awb: str) -> str:
    normalized = sanitize_dhl_awb(awb)
    if not is_valid_dhl_tracking_number(normalized):
        raise HTTPException(status_code=400, detail=DHL_AWB_FORMAT_ERROR)
    return normalized

