"""
Shipment Service Layer
Encapsulates all business logic for tracking and managing shipments.
Endpoints should call these functions instead of containing business logic directly.
"""
import logging
from datetime import datetime, timezone
from typing import Optional, Sequence

from sqlmodel import Session, select
from sqlalchemy import func, case, delete as sa_delete

from app.core.config import settings
from app.models.shipment import Shipment
from app.services.dhl_booking_provider import DHLBookingProvider
from app.services.fedex import FedExService
from app.services.dhl import DHLService
from app.services.carrier_detection import detect_carrier
from app.services.label_storage import save_label_pdf

logger = logging.getLogger(__name__)
STUCK_THRESHOLD_DAYS = 2
STUCK_THRESHOLD_SECONDS = STUCK_THRESHOLD_DAYS * 24 * 60 * 60


def _parse_event_datetime(raw_value: str) -> Optional[datetime]:
    token = str(raw_value or "").strip()
    if not token:
        return None

    normalized = token.replace("Z", "+00:00")
    try:
        dt = datetime.fromisoformat(normalized)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)
    except ValueError:
        pass

    for fmt in (
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%d %H:%M",
        "%Y-%m-%d",
        "%d-%m-%Y %H:%M:%S",
        "%d-%m-%Y",
        "%d/%m/%Y %H:%M:%S",
        "%d/%m/%Y",
        "%m/%d/%Y %H:%M:%S",
        "%m/%d/%Y",
    ):
        try:
            dt = datetime.strptime(token, fmt).replace(tzinfo=timezone.utc)
            return dt
        except ValueError:
            continue
    return None


def _normalize_location(value: Optional[str]) -> str:
    return " ".join(str(value or "").strip().lower().split())


def _is_delivered_status(status: str) -> bool:
    return str(status or "").strip().lower() == "delivered"


def _is_stuck_keyword_present(result: dict) -> bool:
    blob = " ".join(
        str(result.get(key, "") or "")
        for key in ("status", "raw_status", "current_status")
    ).lower()
    keywords = (
        "delay",
        "delayed",
        "hold",
        "held",
        "stuck",
        "shipment exception",
        "clearance delay",
        "exception",
    )
    return any(keyword in blob for keyword in keywords)


def _apply_stuck_policy_to_child_parcels(result: dict, now_utc: datetime) -> None:
    child_parcels = result.get("child_parcels")
    if not isinstance(child_parcels, list):
        return

    for parcel in child_parcels:
        if not isinstance(parcel, dict):
            continue
        if _is_delivered_status(parcel.get("status", "")):
            continue

        last_date = _parse_event_datetime(parcel.get("last_date", ""))
        if last_date is None:
            continue
        if (now_utc - last_date).total_seconds() > STUCK_THRESHOLD_SECONDS:
            parcel["status"] = "Exception"


def _apply_stuck_exception_policy(result: dict) -> dict:
    """
    Carrier-agnostic stuck detection:
    1) If latest checkpoint is older than 2 days (and not delivered) => Exception.
    2) If same location has persisted for over 2 days => Exception.
    3) If carrier text already signals delay/hold/stuck => Exception.
    """
    if not isinstance(result, dict) or "error" in result:
        return result

    current_status = str(result.get("status", "") or "")
    if _is_delivered_status(current_status):
        return result

    history = result.get("history")
    events = history if isinstance(history, list) else []

    now_utc = datetime.now(timezone.utc)
    reasons: list[str] = []
    latest_dt: Optional[datetime] = None
    latest_loc = ""

    parsed_events = []
    for idx, event in enumerate(events):
        if not isinstance(event, dict):
            continue
        dt = _parse_event_datetime(event.get("date", ""))
        loc = _normalize_location(event.get("location"))
        parsed_events.append((idx, dt, loc, event))

    if parsed_events:
        parsed_events.sort(
            key=lambda item: (
                item[1] is not None,
                item[1].timestamp() if item[1] else float("-inf"),
                -item[0],
            ),
            reverse=True,
        )
        _, latest_dt, latest_loc, _ = parsed_events[0]

    if latest_dt and (now_utc - latest_dt).total_seconds() > STUCK_THRESHOLD_SECONDS:
        reasons.append("no_movement_over_2_days")

    if latest_dt and latest_loc:
        oldest_same_loc_dt = latest_dt
        for _, dt, loc, _ in parsed_events[1:]:
            if loc != latest_loc:
                break
            if dt:
                oldest_same_loc_dt = dt
        if (latest_dt - oldest_same_loc_dt).total_seconds() > STUCK_THRESHOLD_SECONDS:
            reasons.append("same_location_over_2_days")

    if _is_stuck_keyword_present(result):
        reasons.append("carrier_marked_delay_or_hold")

    if reasons:
        result["status"] = "Exception"
        result["progress"] = 10
        result["stuck_detected"] = True
        result["stuck_reasons"] = list(dict.fromkeys(reasons))

    _apply_stuck_policy_to_child_parcels(result, now_utc)
    return result


def _progress_from_status(status: str) -> int:
    return {
        "Delivered": 100,
        "Out for Delivery": 80,
        "In Transit": 40,
        "Exception": 10,
    }.get(str(status or "").strip(), 40)


def _derive_lifecycle_state(status: str) -> Optional[str]:
    normalized = str(status or "").strip().lower()
    if not normalized:
        return None
    if normalized == "delivered":
        return "DELIVERED"
    if normalized in {"in transit", "out for delivery", "exception"}:
        return "IN_TRANSIT"
    if normalized == "booked":
        return "BOOKED"
    if normalized == "pickup_scheduled":
        return "PICKUP_SCHEDULED"
    if normalized == "rated":
        return "RATED"
    if normalized == "confirmed":
        return "CONFIRMED"
    if normalized == "draft":
        return "DRAFT"
    return normalized.upper().replace(" ", "_")


def _append_history_event(
    history: list[dict] | None,
    *,
    description: str,
    location: str = "",
    status: str = "",
    event_date: Optional[str] = None,
) -> list[dict]:
    next_history = list(history or [])
    timestamp = event_date or datetime.now(timezone.utc).isoformat()
    next_history.insert(
        0,
        {
            "description": description,
            "location": location,
            "status": status or description,
            "date": timestamp,
        },
    )
    return next_history


def _dhl_shipper_defaults() -> dict[str, str]:
    return {
        "company": settings.DHL_SHIPPER_COMPANY,
        "name": settings.DHL_SHIPPER_NAME,
        "address1": settings.DHL_SHIPPER_ADDRESS1,
        "address2": settings.DHL_SHIPPER_ADDRESS2,
        "address3": settings.DHL_SHIPPER_ADDRESS3,
        "city": settings.DHL_SHIPPER_CITY,
        "postal_code": settings.DHL_SHIPPER_POSTAL_CODE,
        "country_code": settings.DHL_SHIPPER_COUNTRY_CODE,
        "country_name": settings.DHL_SHIPPER_COUNTRY_NAME,
        "phone": settings.DHL_SHIPPER_PHONE,
    }


def _validate_dhl_booking_configuration() -> Optional[str]:
    required = {
        "DHL_WCF_ENDPOINT": settings.DHL_WCF_ENDPOINT,
        "DHL_WCF_PASSWORD": settings.DHL_WCF_PASSWORD,
        "DHL_SHIPPER_ACCOUNT_NUMBER": settings.DHL_SHIPPER_ACCOUNT_NUMBER,
        "DHL_SHIPPER_COMPANY": settings.DHL_SHIPPER_COMPANY,
        "DHL_SHIPPER_NAME": settings.DHL_SHIPPER_NAME,
        "DHL_SHIPPER_ADDRESS1": settings.DHL_SHIPPER_ADDRESS1,
        "DHL_SHIPPER_CITY": settings.DHL_SHIPPER_CITY,
        "DHL_SHIPPER_POSTAL_CODE": settings.DHL_SHIPPER_POSTAL_CODE,
        "DHL_SHIPPER_COUNTRY_CODE": settings.DHL_SHIPPER_COUNTRY_CODE,
        "DHL_SHIPPER_COUNTRY_NAME": settings.DHL_SHIPPER_COUNTRY_NAME,
        "DHL_SHIPPER_PHONE": settings.DHL_SHIPPER_PHONE,
    }
    missing = [key for key, value in required.items() if not str(value or "").strip()]
    if missing:
        return "Missing DHL booking configuration: " + ", ".join(sorted(missing))
    return None


def _build_dhl_rate_payload(payload: dict) -> dict[str, str | int]:
    receiver = payload["receiver"]
    package = payload["package"]
    shipment = payload["shipment"]
    shipper = _dhl_shipper_defaults()
    global_code, local_code = _resolve_dhl_product_codes(
        receiver_country=receiver["country_code"],
        requested_global=shipment.get("service_type"),
        requested_local=shipment.get("local_product_code"),
        shipper_country=shipper["country_code"],
    )

    return {
        "ShipperPostCode": shipper["postal_code"],
        "ReceiverCountryCode": receiver["country_code"],
        "PostCode": receiver["postal_code"],
        "fromCity": shipper["city"],
        "IsDutiable": "Y" if shipment.get("is_dutiable", True) else "N",
        "PickupHours": settings.DHL_DEFAULT_PICKUP_READY_TIME.split(":", 1)[0],
        "PickupMinutes": settings.DHL_DEFAULT_PICKUP_READY_TIME.split(":", 1)[1],
        "DeclaredCurrency": package["declared_currency"],
        "DeclaredValue": str(package["declared_value"]),
        "GlobalProductCode": global_code,
        "LocalProductCode": local_code,
        "NetworkTypeCode": settings.DHL_DEFAULT_NETWORK_TYPE_CODE,
        "toCity": receiver["city"],
        "PaymentAccountNumber": settings.DHL_SHIPPER_ACCOUNT_NUMBER,
        "pieces": int(package["pieces"]),
        "ShipPieceWt": str(package["weight_kg"]),
        "ShipPieceDepth": str(package["length_cm"]),
        "ShipPieceWidth": str(package["width_cm"]),
        "ShipPieceHeight": str(package["height_cm"]),
        "SpecialService": settings.DHL_DEFAULT_SPECIAL_SERVICE,
    }


def _build_dhl_shipment_payload(payload: dict) -> dict[str, str]:
    receiver = payload["receiver"]
    package = payload["package"]
    shipment = payload["shipment"]
    shipper = _dhl_shipper_defaults()
    global_code, local_code = _resolve_dhl_product_codes(
        receiver_country=receiver["country_code"],
        requested_global=shipment.get("service_type"),
        requested_local=shipment.get("local_product_code"),
        shipper_country=shipper["country_code"],
    )

    return {
        "ShippingPaymentType": shipment.get("shipping_payment_type") or settings.DHL_DEFAULT_SHIPPING_PAYMENT_TYPE,
        "ShipperAccNumber": settings.DHL_SHIPPER_ACCOUNT_NUMBER,
        "BillingAccNumber": settings.DHL_BILLING_ACCOUNT_NUMBER or settings.DHL_SHIPPER_ACCOUNT_NUMBER,
        "DutyPaymentType": shipment.get("duty_payment_type") or settings.DHL_DEFAULT_DUTY_PAYMENT_TYPE,
        "DutyAccNumber": settings.DHL_DUTY_ACCOUNT_NUMBER or settings.DHL_SHIPPER_ACCOUNT_NUMBER,
        "ConsigneeCompName": receiver.get("company_name") or receiver["name"],
        "ConsigneeAddLine1": receiver["address_line1"],
        "ConsigneeAddLine2": receiver.get("address_line2") or "",
        "ConsigneeAddLine3": receiver.get("address_line3") or "",
        "ConsigneeCity": receiver["city"],
        "ConsigneeDivCode": receiver.get("state_code") or "",
        "PostalCode": receiver["postal_code"],
        "ConsigneeCountryCode": receiver["country_code"],
        "ConsigneeCountryName": receiver.get("country_name") or receiver["country_code"],
        "ConsigneeName": receiver["name"],
        "ConsigneePh": receiver["phone"],
        "DutiableDeclaredvalue": str(package["declared_value"]),
        "DutiableDeclaredCurrency": package["declared_currency"],
        "ShipNumberOfPieces": str(package["pieces"]),
        "ShipCurrencyCode": settings.DHL_DEFAULT_SHIP_CURRENCY,
        "ShipPieceWt": str(package["weight_kg"]),
        "ShipPieceDepth": str(package["length_cm"]),
        "ShipPieceWidth": str(package["width_cm"]),
        "ShipPieceHeight": str(package["height_cm"]),
        "ShipGlobalProductCode": global_code,
        "ShipLocalProductCode": local_code,
        "ShipContents": shipment["description"],
        "ShipperId": settings.DHL_SHIPPER_ID or settings.DHL_WCF_USERNAME,
        "ShipperCompName": shipper["company"],
        "ShipperAddress1": shipper["address1"],
        "ShipperAddress2": shipper["address2"],
        "ShipperAddress3": shipper["address3"],
        "ShipperCountryCode": shipper["country_code"],
        "ShipperCountryName": shipper["country_name"],
        "ShipperCity": shipper["city"],
        "ShipperPostalCode": shipper["postal_code"],
        "ShipperPhoneNumber": shipper["phone"],
        "SiteId": settings.DHL_SITE_ID or settings.DHL_WCF_USERNAME,
        "Password": settings.DHL_WCF_PASSWORD,
        "ShipperName": shipper["name"],
        "ShipperRef": shipment.get("shipper_reference") or "",
        "IsResponseRequired": "Y",
        "LabelReq": "Y",
        "ConsigneeEmail": receiver.get("email") or "",
        "TermsOfTrade": shipment.get("terms_of_trade") or settings.DHL_DEFAULT_TERMS_OF_TRADE,
    }


def _resolve_dhl_product_codes(
    *,
    receiver_country: str,
    requested_global: Optional[str],
    requested_local: Optional[str],
    shipper_country: str,
) -> tuple[str, str]:
    receiver = (receiver_country or "").strip().upper()
    shipper = (shipper_country or "").strip().upper()
    global_code = (requested_global or "").strip().upper()
    local_code = (requested_local or "").strip().upper()

    is_domestic_india = receiver == "IN" and shipper == "IN"
    if is_domestic_india:
        if not global_code or global_code == settings.DHL_DEFAULT_PRODUCT_CODE:
            global_code = "N"
        if not local_code or local_code == settings.DHL_DEFAULT_LOCAL_PRODUCT_CODE or local_code == settings.DHL_DEFAULT_PRODUCT_CODE:
            local_code = "N"
        return global_code, local_code

    return (
        global_code or settings.DHL_DEFAULT_PRODUCT_CODE,
        local_code or settings.DHL_DEFAULT_LOCAL_PRODUCT_CODE,
    )


def _build_dhl_pickup_payload(shipment: Shipment, *, pickup_date: Optional[str], ready_by_time: Optional[str], closing_time: Optional[str]) -> dict[str, str | int]:
    shipper = _dhl_shipper_defaults()
    ready = (ready_by_time or settings.DHL_DEFAULT_PICKUP_READY_TIME).strip()
    closing = (closing_time or settings.DHL_DEFAULT_PICKUP_CLOSE_TIME).strip()
    pickup_day = (pickup_date or datetime.now(timezone.utc).date().isoformat()).strip()

    ready_hour, ready_minute = _split_time_parts(ready)
    closing_hour, closing_minute = _split_time_parts(closing)

    return {
        "ShipperCompName": shipper["company"],
        "ShipperAdd1": shipper["address1"],
        "ShipperAdd2": shipper["address2"],
        "PackageLocation": settings.DHL_DEFAULT_PICKUP_LOCATION or shipper["address1"],
        "Shippercity": shipper["city"],
        "ShipperPostCode": shipper["postal_code"],
        "ShipperCountyCode": shipper["country_code"],
        "ShipperName": shipper["name"],
        "ShipperPhone": shipper["phone"],
        "PickupClosingTimeHrs": closing_hour,
        "PickupClosingTimeMins": closing_minute,
        "Pieces": str(int(float(shipment.no_of_box or shipment.booking_payload.get("package", {}).get("pieces") or 1))),
        "PickupWeight": str(shipment.package_weight_kg or shipment.booking_payload.get("package", {}).get("weight_kg") or 0),
        "PickupContactName": shipper["name"],
        "PickupContactPhone": shipper["phone"],
        "PickupDate": pickup_day,
        "ReadyByTime": f"{ready_hour:02d}:{ready_minute:02d}",
        "AccountNumber": settings.DHL_SHIPPER_ACCOUNT_NUMBER,
    }


def _split_time_parts(raw_value: str) -> tuple[int, int]:
    token = (raw_value or "").strip()
    try:
        hour_str, minute_str = token.split(":", 1)
        hour = max(0, min(23, int(hour_str)))
        minute = max(0, min(59, int(minute_str)))
        return hour, minute
    except (TypeError, ValueError):
        return 18, 0


def _build_result_from_existing_shipment_row(shipment: Shipment) -> dict:
    return {
        "carrier": shipment.carrier or "Unknown",
        "status": shipment.status or "Unknown",
        "origin": shipment.origin or "Unknown",
        "destination": shipment.destination or "Unknown",
        "eta": shipment.eta or "Unknown",
        "progress": shipment.progress if shipment.progress is not None else _progress_from_status(shipment.status),
        "history": list(shipment.history or []),
        "master_tracking_number": shipment.master_tracking_number,
        "is_master": bool(shipment.is_master),
        "child_parcels": list(shipment.child_parcels or []),
    }


def _resolve_child_fallback_result(
    db: Session,
    tracking_number: str,
    master_tracking_number: Optional[str] = None,
    allow_master_context: bool = False,
) -> Optional[dict]:
    """
    Resolve a child package from already saved master shipment data when the
    carrier API cannot track the child token directly (e.g., DHL piece codes).
    """
    tn = (tracking_number or "").strip().upper()
    if not tn:
        return None

    existing = db.exec(select(Shipment).where(Shipment.tracking_number == tn)).first()
    if existing:
        return _build_result_from_existing_shipment_row(existing)

    masters_to_check: list[Shipment] = []
    master_hint = (master_tracking_number or "").strip().upper()
    if master_hint:
        hinted_master = db.exec(select(Shipment).where(Shipment.tracking_number == master_hint)).first()
        if hinted_master:
            masters_to_check.append(hinted_master)

    if not masters_to_check:
        masters_to_check = db.exec(select(Shipment).where(Shipment.is_archived == False)).all()

    for master in masters_to_check:
        master_tn = (master.tracking_number or "").strip().upper()
        parcels = master.child_parcels or []
        if not isinstance(parcels, list):
            parcels = []
        for parcel in parcels:
            if not isinstance(parcel, dict):
                continue
            child_tn = str(parcel.get("tracking_number") or "").strip().upper()
            if child_tn != tn:
                continue

            child_status = parcel.get("status") or master.status or "In Transit"
            child_raw_status = parcel.get("raw_status") or child_status
            child_last_date = parcel.get("last_date") or ""
            child_last_location = parcel.get("last_location") or ""
            stored_child_history = parcel.get("history")

            child_history = list(stored_child_history) if isinstance(stored_child_history, list) else []
            if not child_history and (child_last_date or child_last_location or child_raw_status):
                child_history.append(
                    {
                        "description": child_raw_status,
                        "location": child_last_location,
                        "status": child_status,
                        "date": child_last_date,
                    }
                )
            elif not child_history and master.history:
                # Use full parent history when child-specific checkpoints are unavailable.
                child_history = list(master.history)

            return {
                "carrier": master.carrier or "DHL",
                "status": child_status,
                "origin": parcel.get("origin") or master.origin or "Unknown",
                "destination": parcel.get("destination") or master.destination or "Unknown",
                "eta": parcel.get("eta") or master.eta or "Unknown",
                "progress": _progress_from_status(child_status),
                "history": child_history,
                "master_tracking_number": master.tracking_number,
                "is_master": False,
                "child_parcels": [],
                "raw_status": child_raw_status,
                "last_scan_date": child_last_date or master.last_scan_date or "",
            }

        if allow_master_context and master_hint and master_tn == master_hint and tn != master_tn:
            return {
                "carrier": master.carrier or "DHL",
                "status": master.status or "In Transit",
                "origin": master.origin or "Unknown",
                "destination": master.destination or "Unknown",
                "eta": master.eta or "Unknown",
                "progress": master.progress if master.progress is not None else _progress_from_status(master.status),
                "history": list(master.history or []),
                "master_tracking_number": master.tracking_number,
                "is_master": False,
                "child_parcels": [],
                "raw_status": master.status or "In Transit",
                "last_scan_date": master.last_scan_date or "",
            }

    return None


def track_and_save(
    tracking_number: str,
    recipient: Optional[str],
    items: Optional[str],
    show_date: Optional[str],
    exhibition_name: str,
    db: Session,
    cs: Optional[str] = None,
    no_of_box: Optional[str] = None,
    project_id: Optional[int] = None,
    booking_date: Optional[str] = None,
    show_city: Optional[str] = None,
    cs_type: Optional[str] = None,
    remarks: Optional[str] = None,
    last_scan_date: Optional[str] = None,
    master_tracking_number: Optional[str] = None,
    is_master: Optional[bool] = None,
    destination: Optional[str] = None,
) -> dict:
    """
    Detect carrier, call tracking API, then upsert the shipment record in DB.
    Returns a result dict. On error, the dict will contain an 'error' key.
    """
    tracking_number = (tracking_number or "").strip().upper()
    carrier_name = detect_carrier(tracking_number)
    result: dict
    service = None

    if carrier_name == "DHL":
        service = DHLService()
    elif carrier_name == "FedEx":
        service = FedExService()
    elif carrier_name in ("UPS", "Unknown"):
        fallback = _resolve_child_fallback_result(
            db=db,
            tracking_number=tracking_number,
            master_tracking_number=master_tracking_number,
        )
        if fallback:
            result = fallback
            carrier_name = str(result.get("carrier") or carrier_name)
            logger.info(
                "Resolved %s from stored master/child data (carrier=%s) without live API call.",
                tracking_number,
                carrier_name,
            )
        elif carrier_name == "UPS":
            return {
                "tracking_number": tracking_number,
                "error": "UPS tracking is not yet supported. Supported carriers: FedEx, DHL.",
            }
        else:
            supported_formats = (
                "Supported formats: FedEx (12/15/20/22 digits), DHL "
                "(10-digit AWB, eCommerce ID, or JD child piece ID), UPS (1Z...)."
            )
            return {
                "tracking_number": tracking_number,
                "error": f"Could not detect carrier for tracking number '{tracking_number}'. "
                f"{supported_formats}",
            }
    else:
        return {
            "tracking_number": tracking_number,
            "error": f"Could not detect carrier for tracking number '{tracking_number}'.",
        }

    if service is not None and master_tracking_number:
        contextual_fallback = _resolve_child_fallback_result(
            db=db,
            tracking_number=tracking_number,
            master_tracking_number=master_tracking_number,
            allow_master_context=(carrier_name == "DHL"),
        )
        if contextual_fallback:
            result = contextual_fallback
            carrier_name = str(result.get("carrier") or carrier_name)
            service = None
            logger.info(
                "Resolved child shipment %s from %s master context before live carrier lookup.",
                tracking_number,
                carrier_name,
            )

    if service is not None:
        result = service.track(tracking_number)

        if "error" in result:
            fallback = _resolve_child_fallback_result(
                db=db,
                tracking_number=tracking_number,
                master_tracking_number=master_tracking_number,
                allow_master_context=(carrier_name == "DHL"),
            )
            if fallback:
                result = fallback
                carrier_name = str(result.get("carrier") or carrier_name)
                logger.info(
                    "Carrier lookup failed for %s (%s) but resolved from stored master/child data.",
                    tracking_number,
                    carrier_name,
                )
            else:
                logger.warning("Tracking failed for %s (%s): %s", tracking_number, carrier_name, result["error"])
                return {"tracking_number": tracking_number, "error": result["error"]}

    result = _apply_stuck_exception_policy(result)

    destination_input = (destination or "").strip()
    api_destination = result.get("destination")
    resolved_destination = (
        api_destination
        if api_destination and api_destination != "Unknown"
        else (destination_input or "Unknown")
    )

    # Upsert: find existing record or create new one
    statement = select(Shipment).where(Shipment.tracking_number == tracking_number)
    shipment = db.exec(statement).first()

    if not shipment:
        shipment = Shipment(
            tracking_number=tracking_number,
            awb=tracking_number if carrier_name == "DHL" else None,
            carrier=carrier_name,
            status=result.get("status", "Unknown"),
            lifecycle_state=_derive_lifecycle_state(result.get("status", "Unknown")),
            recipient=recipient or "",
            exhibition_name=exhibition_name,
            show_date=show_date,
            project_id=project_id,
            origin=result.get("origin", "Unknown"),
            destination=resolved_destination,
            eta=result.get("eta", "TBD"),
            progress=result.get("progress", 0),
            items=items or "Package",
            history=result.get("history", []),
            cs=cs,
            no_of_box=no_of_box,
            booking_date=booking_date,
            show_city=show_city,
            cs_type=cs_type,
            remarks=remarks,
            last_scan_date=result.get("last_scan_date", last_scan_date),
            master_tracking_number=master_tracking_number or result.get("master_tracking_number"),
            is_master=is_master if is_master is not None else result.get("is_master", False),
            child_parcels=result.get("child_parcels", []),
        )
        logger.info("Created new shipment record for %s (%s)", tracking_number, carrier_name)
    else:
        shipment.status = result.get("status", shipment.status)
        shipment.lifecycle_state = _derive_lifecycle_state(shipment.status)

        if recipient:
            shipment.recipient = recipient
        if items:
            shipment.items = items
        if show_date:
            shipment.show_date = show_date
        if exhibition_name and exhibition_name != "Unknown Exhibition":
            shipment.exhibition_name = exhibition_name
        if cs:
            shipment.cs = cs
        if no_of_box is not None:
            shipment.no_of_box = no_of_box
        if project_id is not None:
            shipment.project_id = project_id
        if booking_date is not None:
            shipment.booking_date = booking_date
        if show_city is not None:
            shipment.show_city = show_city
        if cs_type is not None:
            shipment.cs_type = cs_type
        if remarks is not None:
            shipment.remarks = remarks
        if last_scan_date is not None:
            shipment.last_scan_date = last_scan_date


        # Only update fields if the API returned meaningful data
        if result.get("origin") and result.get("origin") != "Unknown":
            shipment.origin = result["origin"]
        if api_destination and api_destination != "Unknown":
            shipment.destination = api_destination
        elif destination_input:
            shipment.destination = destination_input
        if result.get("eta") and result.get("eta") not in ("Unknown", "TBD"):
            shipment.eta = result["eta"]
        if result.get("progress") is not None:
            shipment.progress = result["progress"]
        if result.get("history"):
            shipment.history = result["history"]
            
        # MPS updates
        if master_tracking_number is not None:
            shipment.master_tracking_number = master_tracking_number
        elif result.get("master_tracking_number"):
            shipment.master_tracking_number = result["master_tracking_number"]
            
        if is_master is not None:
            shipment.is_master = is_master
        elif "is_master" in result:
            shipment.is_master = result["is_master"]
        if result.get("child_parcels") is not None:
            # Reassigning the list so SQLModel detects the JSON change
            shipment.child_parcels = list(result["child_parcels"])
        if carrier_name == "DHL" and not shipment.awb:
            shipment.awb = tracking_number

        logger.info("Updated shipment record for %s", tracking_number)

    db.add(shipment)
    db.commit()
    db.refresh(shipment)

    return {"tracking_number": tracking_number, "status": "success", "carrier": carrier_name}


def rate_shipment(payload: dict) -> dict:
    config_error = _validate_dhl_booking_configuration()
    if config_error:
        return {"error": config_error}

    provider = DHLBookingProvider()
    result = provider.rate(_build_dhl_rate_payload(payload))
    if "error" in result:
        logger.warning("DHL rate failed: %s", result["error"])
        return {"error": result["error"]}

    return {
        "status": "RATED",
        "lifecycle_state": "RATED",
        "price": result["price"],
        "currency": result["currency"],
        "delivery_time": result.get("delivery_time"),
        "service_type": payload["shipment"].get("service_type") or settings.DHL_DEFAULT_PRODUCT_CODE,
    }


def create_shipment(payload: dict, db: Session) -> dict:
    config_error = _validate_dhl_booking_configuration()
    if config_error:
        return {"error": config_error}

    provider = DHLBookingProvider()
    shipment_payload = _build_dhl_shipment_payload(payload)
    result = provider.create_shipment(shipment_payload)
    if "error" in result:
        logger.warning("DHL shipment creation failed: %s", result["error"])
        return {"error": result["error"]}

    awb = str(result["awb"]).strip().upper()
    try:
        label_path, label_url = save_label_pdf(awb=awb, label_base64=result["label_base64"])
    except ValueError as exc:
        logger.warning("DHL label handling failed for %s: %s", awb, exc)
        return {"error": str(exc)}

    existing = db.exec(select(Shipment).where(Shipment.tracking_number == awb)).first()
    quote = rate_shipment(payload)
    quote_amount = quote.get("price") if "error" not in quote else None
    quote_currency = quote.get("currency") if "error" not in quote else None
    quoted_delivery_time = quote.get("delivery_time") if "error" not in quote else None
    shipper = _dhl_shipper_defaults()
    receiver = payload["receiver"]
    package = payload["package"]
    shipment_input = payload["shipment"]
    location = ", ".join(
        token for token in [shipper["city"], shipper["country_code"]] if token
    )

    booking_history = _append_history_event(
        existing.history if existing else [],
        description="Shipment booked with DHL",
        location=location,
        status="BOOKED",
    )

    if existing is None:
        existing = Shipment(
            tracking_number=awb,
            awb=awb,
            carrier="DHL",
            status="BOOKED",
            lifecycle_state="BOOKED",
            origin=location or "Unknown",
            destination=", ".join(
                token for token in [receiver["city"], receiver["country_code"]] if token
            ) or "Unknown",
            recipient=receiver["name"],
            exhibition_name=shipment_input.get("exhibition_name"),
            items=shipment_input["description"],
            eta=quoted_delivery_time,
            progress=5,
            show_date=shipment_input.get("show_date"),
            no_of_box=str(package["pieces"]),
            booking_date=datetime.now(timezone.utc).date().isoformat(),
            history=booking_history,
            label_url=label_url,
            label_path=label_path,
            quote_amount=quote_amount,
            quote_currency=quote_currency,
            quoted_delivery_time=quoted_delivery_time,
            service_type=shipment_input.get("service_type") or settings.DHL_DEFAULT_PRODUCT_CODE,
            package_weight_kg=package["weight_kg"],
            package_length_cm=package["length_cm"],
            package_width_cm=package["width_cm"],
            package_height_cm=package["height_cm"],
            booking_payload=payload,
            project_id=shipment_input.get("project_id"),
            pickup_status=None,
        )
        logger.info("Created booked DHL shipment row awb=%s", awb)
    else:
        existing.awb = awb
        existing.carrier = "DHL"
        existing.status = "BOOKED"
        existing.lifecycle_state = "BOOKED"
        existing.origin = location or existing.origin
        existing.destination = ", ".join(
            token for token in [receiver["city"], receiver["country_code"]] if token
        ) or existing.destination
        existing.recipient = receiver["name"]
        existing.items = shipment_input["description"]
        existing.exhibition_name = shipment_input.get("exhibition_name") or existing.exhibition_name
        existing.show_date = shipment_input.get("show_date") or existing.show_date
        existing.eta = quoted_delivery_time or existing.eta
        existing.progress = 5
        existing.no_of_box = str(package["pieces"])
        existing.booking_date = datetime.now(timezone.utc).date().isoformat()
        existing.history = booking_history
        existing.label_url = label_url
        existing.label_path = label_path
        existing.quote_amount = quote_amount if quote_amount is not None else existing.quote_amount
        existing.quote_currency = quote_currency or existing.quote_currency
        existing.quoted_delivery_time = quoted_delivery_time or existing.quoted_delivery_time
        existing.service_type = shipment_input.get("service_type") or existing.service_type
        existing.package_weight_kg = package["weight_kg"]
        existing.package_length_cm = package["length_cm"]
        existing.package_width_cm = package["width_cm"]
        existing.package_height_cm = package["height_cm"]
        existing.booking_payload = payload
        if shipment_input.get("project_id") is not None:
            existing.project_id = shipment_input["project_id"]
        logger.info("Updated booked DHL shipment row awb=%s", awb)

    db.add(existing)
    db.commit()
    db.refresh(existing)

    return {
        "status": "BOOKED",
        "lifecycle_state": "BOOKED",
        "awb": awb,
        "tracking_number": awb,
        "label_url": label_url,
        "shipment_id": existing.id,
    }


def schedule_pickup(
    awb: str,
    db: Session,
    *,
    pickup_date: Optional[str] = None,
    ready_by_time: Optional[str] = None,
    closing_time: Optional[str] = None,
) -> dict:
    config_error = _validate_dhl_booking_configuration()
    if config_error:
        return {"error": config_error}

    tracking_number = (awb or "").strip().upper()
    shipment = db.exec(select(Shipment).where(Shipment.tracking_number == tracking_number)).first()
    if shipment is None:
        return {"error": "Shipment not found for pickup scheduling"}

    provider = DHLBookingProvider()
    pickup_payload = _build_dhl_pickup_payload(
        shipment,
        pickup_date=pickup_date,
        ready_by_time=ready_by_time,
        closing_time=closing_time,
    )
    result = provider.schedule_pickup(pickup_payload)
    if "error" in result:
        logger.warning("DHL pickup scheduling failed for %s: %s", tracking_number, result["error"])
        return {"error": result["error"]}

    shipment.pickup_id = result["pickup_id"]
    shipment.pickup_status = "SCHEDULED"
    shipment.status = "PICKUP_SCHEDULED"
    shipment.lifecycle_state = "PICKUP_SCHEDULED"
    shipment.history = _append_history_event(
        shipment.history,
        description="Pickup scheduled with DHL",
        location=shipment.origin or "",
        status="PICKUP_SCHEDULED",
    )
    db.add(shipment)
    db.commit()
    db.refresh(shipment)

    return {
        "status": "PICKUP_SCHEDULED",
        "lifecycle_state": "PICKUP_SCHEDULED",
        "awb": tracking_number,
        "pickup_id": shipment.pickup_id,
        "pickup_status": shipment.pickup_status,
    }


def get_stats(db: Session) -> dict:
    """
    Return counts for main shipments and total child parcels.
    A 'main' shipment is either an MPS master or a standalone parcel.
    """
    # Simple inclusive count of all non-archived shipments to match the main list view
    main_query = select(
        func.count().label("total"),
        func.sum(case((Shipment.status == "Delivered", 1), else_=0)).label("delivered"),
        func.sum(case((Shipment.status.in_(["In Transit", "Out for Delivery"]), 1), else_=0)).label("transit"),
        func.sum(case((Shipment.status == "Exception", 1), else_=0)).label("exceptions"),
    ).where(Shipment.is_archived == False)
    main_result = db.exec(main_query).one()

    # Child parcel counts (summing the JSON arrays from master records)
    # We use a simple select and sum in Python here for JSON compatibility across DBs,
    # or we can try to use SQL func if we're sure about the JSON structure.
    # Given the small scale, fetching masters and summing is safer.
    masters = db.exec(select(Shipment).where(
        (Shipment.is_master == True) & (Shipment.is_archived == False)
    )).all()
    
    child_total = 0
    child_delivered = 0
    child_transit = 0
    child_exceptions = 0
    
    for m in masters:
        parcels = m.child_parcels or []
        child_total += len(parcels)
        for p in parcels:
            status = p.get("status")
            if status == "Delivered":
                child_delivered += 1
            elif status in ("In Transit", "Out for Delivery"):
                child_transit += 1
            elif status == "Exception":
                child_exceptions += 1

    return {
        "total": main_result.total or 0,
        "delivered": main_result.delivered or 0,
        "transit": main_result.transit or 0,
        "exceptions": main_result.exceptions or 0,
        "child_stats": {
            "total": child_total,
            "delivered": child_delivered,
            "transit": child_transit,
            "exceptions": child_exceptions
        }
    }


def preview_track(
    tracking_number: str,
    db: Optional[Session] = None,
    master_tracking_number: Optional[str] = None,
) -> dict:
    """
    Fetch live tracking data from the carrier API WITHOUT saving to the DB.
    Returns the full result dict (including history, origin, destination, eta).
    On error, the dict will contain an 'error' key.
    """
    tracking_number = (tracking_number or "").strip().upper()
    carrier_name = detect_carrier(tracking_number)
    service = None

    if carrier_name == "DHL":
        service = DHLService()
    elif carrier_name == "FedEx":
        service = FedExService()
    elif carrier_name in ("UPS", "Unknown"):
        if db is not None:
            fallback = _resolve_child_fallback_result(
                db=db,
                tracking_number=tracking_number,
                master_tracking_number=master_tracking_number,
            )
            if fallback:
                result = _apply_stuck_exception_policy(fallback)
                result["tracking_number"] = tracking_number
                result["carrier"] = str(result.get("carrier") or carrier_name)
                return result
        if carrier_name == "UPS":
            return {"error": "UPS tracking is not yet supported."}
        return {"error": f"Could not detect carrier for '{tracking_number}'."}

    if service is not None and db is not None and master_tracking_number:
        contextual_fallback = _resolve_child_fallback_result(
            db=db,
            tracking_number=tracking_number,
            master_tracking_number=master_tracking_number,
            allow_master_context=(carrier_name == "DHL"),
        )
        if contextual_fallback:
            result = _apply_stuck_exception_policy(contextual_fallback)
            result["tracking_number"] = tracking_number
            result["carrier"] = str(result.get("carrier") or carrier_name)
            return result

    result = service.track(tracking_number)
    if "error" in result:
        if db is not None:
            fallback = _resolve_child_fallback_result(
                db=db,
                tracking_number=tracking_number,
                master_tracking_number=master_tracking_number,
                allow_master_context=(carrier_name == "DHL"),
            )
            if fallback:
                result = fallback
                carrier_name = str(result.get("carrier") or carrier_name)
            else:
                return result
        else:
            return result

    result = _apply_stuck_exception_policy(result)

    # Attach metadata the frontend needs
    result["tracking_number"] = tracking_number
    result["carrier"] = carrier_name
    return result


def refresh_tracked_shipments(
    db: Session,
    shipment_ids: Optional[Sequence[int]] = None,
    include_archived: bool = False,
    include_children: bool = False,
) -> dict:
    """
    Re-sync one or more saved shipments from the carrier APIs.
    Useful for pulling fresh statuses and hydrating MPS child parcels that may
    have been missing in older saved records.
    """
    statement = select(Shipment)
    if shipment_ids:
        statement = statement.where(Shipment.id.in_(list(shipment_ids)))
    # By default, refresh only top-level shipments (masters + standalone)
    # to avoid expensive N+1 carrier calls for child records.
    if not shipment_ids and not include_children:
        statement = statement.where(
            (Shipment.master_tracking_number.is_(None))
            | (Shipment.master_tracking_number == "")
        )
    if not include_archived:
        statement = statement.where(Shipment.is_archived == False)

    shipments = db.exec(statement).all()
    refreshed = 0
    errors: list[str] = []

    for shipment in shipments:
        result = track_and_save(
            tracking_number=shipment.tracking_number,
            recipient=shipment.recipient,
            items=shipment.items,
            show_date=shipment.show_date,
            exhibition_name=shipment.exhibition_name or "Unknown Exhibition",
            db=db,
            cs=shipment.cs,
            no_of_box=shipment.no_of_box,
            project_id=shipment.project_id,
        )
        if "error" in result:
            errors.append(f"{shipment.tracking_number}: {result['error']}")
        else:
            refreshed += 1

    return {
        "requested": len(shipments),
        "refreshed": refreshed,
        "failed": len(errors),
        "errors": errors,
    }


def toggle_archive(shipment_id: int, db: Session) -> Optional[Shipment]:
    """
    Toggle the is_archived flag for a shipment.
    Returns the updated shipment or None if not found.
    """
    shipment = db.get(Shipment, shipment_id)
    if not shipment:
        return None
    
    shipment.is_archived = not shipment.is_archived
    db.add(shipment)
    db.commit()
    db.refresh(shipment)
    return shipment


def batch_update_archive(shipment_ids: list[int], archive: bool, db: Session) -> dict:
    """Batch update the is_archived status for multiple shipments."""
    statement = select(Shipment).where(Shipment.id.in_(shipment_ids))
    shipments = db.exec(statement).all()
    
    for s in shipments:
        s.is_archived = archive
        db.add(s)
    
    db.commit()
    return {"status": "success", "count": len(shipments)}


def batch_delete(shipment_ids: list[int], db: Session) -> dict:
    """
    Batch delete multiple shipments.

    If a top-level/master shipment is deleted, all linked child rows
    (where child.master_tracking_number == master.tracking_number) are
    deleted as well so the UI cannot surface orphan child records.
    """
    if not shipment_ids:
        return {"status": "success", "count": 0, "deleted_ids": []}

    requested = db.exec(select(Shipment).where(Shipment.id.in_(shipment_ids))).all()
    if not requested:
        return {"status": "success", "count": 0, "deleted_ids": []}

    ids_to_delete: set[int] = {s.id for s in requested if s.id is not None}
    pending_master_tns = {
        (s.tracking_number or "").strip().upper()
        for s in requested
        if (s.tracking_number or "").strip()
    }
    seen_master_tns: set[str] = set()

    # Cascade through all linked descendants in one pass (supports nested linkage).
    while pending_master_tns:
        lookup_tns = pending_master_tns - seen_master_tns
        if not lookup_tns:
            break
        seen_master_tns.update(lookup_tns)

        child_rows = db.exec(
            select(Shipment.id, Shipment.tracking_number).where(
                func.upper(func.trim(func.coalesce(Shipment.master_tracking_number, ""))).in_(
                    list(lookup_tns)
                )
            )
        ).all()

        pending_master_tns = set()
        for row in child_rows:
            child_id = row[0]
            child_tn = (row[1] or "").strip().upper() if len(row) > 1 else ""
            if child_id is not None:
                ids_to_delete.add(child_id)
            if child_tn:
                pending_master_tns.add(child_tn)

    if not ids_to_delete:
        return {"status": "success", "count": 0, "deleted_ids": []}

    deleted_ids = sorted(ids_to_delete)
    db.exec(sa_delete(Shipment).where(Shipment.id.in_(deleted_ids)))
    db.commit()
    return {"status": "success", "count": len(deleted_ids), "deleted_ids": deleted_ids}
