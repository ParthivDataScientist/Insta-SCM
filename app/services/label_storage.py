from __future__ import annotations

import base64
import binascii
import logging
from pathlib import Path

from app.core.config import settings

logger = logging.getLogger(__name__)


def _labels_directory() -> Path:
    path = Path(settings.STORAGE_DIR) / settings.DHL_LABELS_SUBDIR
    path.mkdir(parents=True, exist_ok=True)
    return path


def save_label_pdf(*, awb: str, label_base64: str) -> tuple[str, str]:
    token = (label_base64 or "").strip()
    if not token:
        raise ValueError("Missing DHL label payload")

    if "," in token and token.lower().startswith("data:"):
        token = token.split(",", 1)[1].strip()

    try:
        pdf_bytes = base64.b64decode(token, validate=False)
    except (binascii.Error, ValueError) as exc:
        raise ValueError("Invalid DHL label encoding") from exc

    if not pdf_bytes:
        raise ValueError("Decoded DHL label was empty")

    if not pdf_bytes.startswith(b"%PDF"):
        logger.warning("dhl_label_not_pdf_signature awb=%s", awb)

    labels_dir = _labels_directory()
    filename = f"{awb}.pdf"
    file_path = labels_dir / filename
    file_path.write_bytes(pdf_bytes)

    relative_url = f"/storage/{settings.DHL_LABELS_SUBDIR}/{filename}"
    return str(file_path), relative_url
