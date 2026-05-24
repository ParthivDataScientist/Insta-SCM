import asyncio
import base64
import html
import logging
import re
from datetime import datetime
from typing import Any
import xml.etree.ElementTree as ET

import httpx

from app.core.config import settings
from app.services.carrier_base import HISTORY_STATUS_MAP
from app.services.dhl_validation import (
    DHL_AWB_FORMAT_ERROR,
    is_dhl_child_piece_id,
    is_valid_dhl_tracking_number,
    sanitize_dhl_awb,
)

logger = logging.getLogger(__name__)

DHL_CHILD_PIECE_CONTEXT_ERROR = (
    "DHL child piece IDs require the related master AWB for tracking. "
    "Track or import the master shipment first so the child package can be resolved from the DHL shipment hierarchy."
)
DHL_SOAP_INTERNAL_ERROR = (
    "DHL tracking service returned an internal error. Please verify the AWB and try again."
)

DHL_EVENT_CODE_MAP = {
    **HISTORY_STATUS_MAP,
    "AF": "Arrived at Facility",
    "DF": "Departed Facility",
    "PL": "Processed",
    "AR": "Arrived",
    "OH": "On Hold",
    "RR": "Customs Update",
    "WC": "With Delivery Courier",
}


def _local_name(tag: str) -> str:
    if "}" in tag:
        return tag.split("}", 1)[1]
    return tag


def _text_or_empty(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return value.strip()
    return str(value).strip()


class DHLProvider:
    """
    DHL Express India SOAP/WCF provider.

    This class is intentionally carrier-specific and does not include
    any logic for FedEx, UPS, or BlueDart.
    """

    NON_DHL_MARKERS = ("FEDEX", "UPS", "BLUEDART", "BLUE DART", "1Z")
    SOAP11_ENVELOPE_NS = "http://schemas.xmlsoap.org/soap/envelope/"
    SOAP12_ENVELOPE_NS = "http://www.w3.org/2003/05/soap-envelope"
    OP_POST_TRACKING = "PostTracking"
    OP_POST_TRACKING_ALL = "PostTracking_AllCheckpoint"
    ACTION_POST_TRACKING = "http://tempuri.org/IDHLService/PostTracking"
    ACTION_POST_TRACKING_ALL = "http://tempuri.org/IDHLService/PostTracking_AllCheckpoint"

    def __init__(self) -> None:
        self.wsdl_url = settings.DHL_WCF_WSDL_URL
        self.endpoint = settings.DHL_WCF_ENDPOINT
        self.soap_action = settings.DHL_WCF_SOAP_ACTION
        self.soap_version = settings.DHL_WCF_SOAP_VERSION
        self.timeout_seconds = settings.DHL_WCF_TIMEOUT_SECONDS
        self.username = settings.DHL_WCF_USERNAME
        self.password = settings.DHL_WCF_PASSWORD

    async def track(self, awb: str) -> dict[str, Any]:
        normalized_awb = sanitize_dhl_awb(awb)
        isolation_error = self._validate_input(normalized_awb, raw_input=awb)
        if isolation_error:
            return {"carrier": "DHL", "error": isolation_error}

        all_checkpoint_task = self._fetch_tracking_payload(
            awb=normalized_awb,
            operation=self.OP_POST_TRACKING_ALL,
            soap_action=self.ACTION_POST_TRACKING_ALL,
            result_node="PostTracking_AllCheckpointResult",
        )
        summary_task = self._fetch_tracking_payload(
            awb=normalized_awb,
            operation=self.OP_POST_TRACKING,
            soap_action=self.soap_action or self.ACTION_POST_TRACKING,
            result_node="PostTrackingResult",
        )
        all_checkpoint, summary = await asyncio.gather(all_checkpoint_task, summary_task)

        if all_checkpoint.get("error") and all_checkpoint["error"] != "Shipment not found":
            logger.warning("DHL all-checkpoint call failed for %s: %s", normalized_awb, all_checkpoint["error"])

        if summary.get("error") and all_checkpoint.get("error"):
            # If both failed, return the summary error (unless it's just "not found")
            return {"carrier": "DHL", "error": summary["error"]}

        # If one of them succeeded, we proceed with merged data
        detailed_data = all_checkpoint.get("parsed", {})
        summary_data = summary.get("parsed", {})
        
        merged = self._merge_tracking_payloads(
            detailed=detailed_data,
            summary=summary_data,
        )
        if merged.get("error"):
            return {"carrier": "DHL", "error": merged["error"]}
        return {"carrier": "DHL", **merged}

    def _validate_input(self, awb: str, *, raw_input: str) -> str | None:
        upper_input = _text_or_empty(raw_input).upper()
        if any(marker in upper_input for marker in self.NON_DHL_MARKERS):
            return DHL_AWB_FORMAT_ERROR

        if not is_valid_dhl_tracking_number(awb):
            return DHL_AWB_FORMAT_ERROR

        return None

    async def _fetch_tracking_payload(
        self,
        *,
        awb: str,
        operation: str,
        soap_action: str,
        result_node: str,
    ) -> dict[str, Any]:
        envelope = self._build_post_tracking_envelope(awb, operation=operation)
        headers = self._build_headers(soap_action_override=soap_action)

        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    self.endpoint,
                    content=envelope.encode("utf-8"),
                    headers=headers,
                    timeout=self.timeout_seconds,
                )
        except httpx.HTTPError as exc:
            logger.error("DHL SOAP request failed for %s (%s): %s", awb, operation, exc)
            return {"error": f"DHL SOAP Request Failed: {exc}"}

        if response.status_code >= 400:
            fault = self._extract_fault_message(response.text)
            detail = fault or f"HTTP {response.status_code}"
            return {"error": self._format_soap_error(normalized_awb=awb, detail=detail)}

        extraction = self._extract_post_tracking_result(
            response.text,
            result_node=result_node,
            normalized_awb=awb,
        )
        if extraction.get("error"):
            return {"error": extraction["error"]}

        payload = extraction.get("payload", "")
        parsed = self._map_tracking_payload(payload)
        if parsed.get("error"):
            return {"error": parsed["error"]}
        return {"parsed": parsed}

    def _merge_tracking_payloads(self, *, detailed: dict[str, Any], summary: dict[str, Any]) -> dict[str, Any]:
        base = detailed or summary or {}
        if not base:
            return {"error": "No shipment data found"}

        merged_history = detailed.get("history") or summary.get("history") or []

        return {
            "current_status": detailed.get("current_status") or summary.get("current_status") or "Unknown",
            "estimated_delivery": detailed.get("estimated_delivery") or summary.get("estimated_delivery"),
            "last_location": detailed.get("last_location") or summary.get("last_location"),
            "status": detailed.get("status") or summary.get("status") or "In Transit",
            "eta": detailed.get("eta") or summary.get("eta") or "Unknown",
            "history": merged_history,
            "origin": detailed.get("origin") or summary.get("origin") or "Unknown",
            "destination": detailed.get("destination") or summary.get("destination") or "Unknown",
            "progress": detailed.get("progress") if detailed.get("progress") is not None else summary.get("progress", 40),
        }

    def _build_headers(self, soap_action_override: str | None = None) -> dict[str, str]:
        # WSDL bindings expose PostTracking under SOAP 1.1.
        action = soap_action_override or self.soap_action or self.ACTION_POST_TRACKING
        if self.soap_version == "1.2":
            content_type = (
                f'application/soap+xml; charset=utf-8; action="{action}"'
            )
            headers = {"Content-Type": content_type}
        else:
            headers = {
                "Content-Type": "text/xml; charset=utf-8",
                "SOAPAction": f'"{action}"',
            }

        if self.username and self.password:
            token = base64.b64encode(f"{self.username}:{self.password}".encode("utf-8")).decode("ascii")
            headers["Authorization"] = f"Basic {token}"

        return headers

    def _build_post_tracking_envelope(self, awb: str, *, operation: str = OP_POST_TRACKING) -> str:
        # WSDL (`xsd0`) defines this field as `awbnumber`.
        return (
            '<?xml version="1.0" encoding="utf-8"?>'
            '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" '
            'xmlns:tem="http://tempuri.org/">'
            "<soapenv:Header/>"
            "<soapenv:Body>"
            f"<tem:{operation}>"
            f"<tem:awbnumber>{awb}</tem:awbnumber>"
            f"</tem:{operation}>"
            "</soapenv:Body>"
            "</soapenv:Envelope>"
        )

    def _extract_fault_message(self, soap_xml: str) -> str:
        try:
            root = ET.fromstring(soap_xml)
        except ET.ParseError:
            return ""

        fault_node = root.find(".//{*}Fault")
        if fault_node is None:
            return ""

        fault_text = fault_node.findtext(".//{*}faultstring") or fault_node.findtext(".//{*}Text") or ""
        return _text_or_empty(fault_text)

    def _format_soap_error(self, *, normalized_awb: str, detail: str) -> str:
        message = _text_or_empty(detail)
        lower_message = message.lower()
        if "object reference not set to an instance of an object" in lower_message:
            if is_dhl_child_piece_id(normalized_awb):
                return DHL_CHILD_PIECE_CONTEXT_ERROR
            return DHL_SOAP_INTERNAL_ERROR
        return f"DHL SOAP Error: {message or 'Unknown carrier error'}"

    def _extract_post_tracking_result(
        self,
        soap_xml: str,
        *,
        result_node: str,
        normalized_awb: str,
    ) -> dict[str, str]:
        try:
            root = ET.fromstring(soap_xml)
        except ET.ParseError as exc:
            return {"error": f"Failed to parse DHL SOAP envelope: {exc}"}

        fault_message = self._extract_fault_message(soap_xml)
        if fault_message:
            return {"error": self._format_soap_error(normalized_awb=normalized_awb, detail=fault_message)}

        result = root.find(f".//{{*}}{result_node}")
        if result is None:
            return {"error": f"DHL SOAP response missing {result_node}"}

        payload = html.unescape(_text_or_empty(result.text))
        if not payload:
            return {"error": "Empty DHL tracking payload"}

        if "No Shipments Found" in payload:
            return {"error": "Shipment not found"}

        return {"payload": payload}

    def _map_tracking_payload(self, payload: str) -> dict[str, Any]:
        payload = payload.strip()
        if not payload:
            return {"error": "Empty tracking payload"}

        if not payload.startswith("<"):
            return {
                "current_status": payload,
                "estimated_delivery": None,
                "last_location": None,
                "status": "In Transit",
                "eta": "Unknown",
                "history": [],
                "origin": "Unknown",
                "destination": "Unknown",
                "progress": 40,
            }

        try:
            payload_root = ET.fromstring(payload)
        except ET.ParseError:
            # Some responses can be doubly escaped.
            decoded = html.unescape(payload)
            try:
                payload_root = ET.fromstring(decoded)
            except ET.ParseError as exc:
                return {"error": f"Unable to parse DHL tracking payload: {exc}"}

        awb_info = self._parse_awb_info_payload(payload_root)
        if awb_info is not None:
            return awb_info

        payload_data = self._xml_to_dict(payload_root)
        events = self._extract_events(payload_data)
        latest_event = self._pick_latest_event(events)

        current_status = self._extract_status(latest_event, payload_data)
        estimated_delivery = self._extract_estimated_delivery(payload_data)
        last_location = self._extract_location(latest_event, payload_data)

        history = []
        for event in events:
            description = self._first_non_empty(
                event,
                [
                    "EventDescription",
                    "Description",
                    "StatusDescription",
                    "Status",
                    "ActionStatus",
                ],
            )
            location = self._extract_location(event, payload_data={})
            event_time = self._extract_event_datetime(event)
            if description or location or event_time:
                history.append(
                    {
                        "description": description or current_status or "Unknown",
                        "location": location or "",
                        "status": description or "",
                        "date": event_time or "",
                    }
                )

        if history:
            history.sort(key=lambda item: item.get("date", ""), reverse=True)

        event_code = self._first_non_empty(latest_event, ["EventCode", "StatusCode", "Code"])
        status_bucket = self._to_status_bucket(current_status, event_code=event_code)
        progress = {
            "Delivered": 100,
            "Out for Delivery": 80,
            "In Transit": 40,
            "Exception": 10,
        }.get(status_bucket, 40)

        return {
            "current_status": current_status or "Unknown",
            "estimated_delivery": estimated_delivery,
            "last_location": last_location,
            "status": status_bucket,
            "eta": estimated_delivery or "Unknown",
            "history": history,
            "origin": "Unknown",
            "destination": "Unknown",
            "progress": progress,
        }

    def _parse_awb_info_payload(self, payload_root: ET.Element) -> dict[str, Any] | None:
        root_name = _local_name(payload_root.tag).lower()
        if root_name != "awbinfo":
            return None

        events = []
        for node in payload_root.findall(".//ShipmentEvent"):
            p_ref = (
                _text_or_empty(node.findtext("PieceID")) or
                _text_or_empty(node.findtext("LicensePlate")) or
                _text_or_empty(node.findtext("PieceNumber"))
            )
            event = {
                "date": _text_or_empty(node.findtext("Date")),
                "time": _text_or_empty(node.findtext("Time")),
                "event_code": _text_or_empty(node.findtext("EventCode")),
                "description": _text_or_empty(node.findtext("Description")),
                "location": _text_or_empty(node.findtext("ServiceAreaDescription")),
            }
            if not event["location"]:
                event["location"] = _text_or_empty(node.findtext("ServiceAreaCode"))
            if p_ref:
                event["piece_ref"] = p_ref
            events.append(event)

        if events:
            history: list[dict[str, str]] = []
            for event in events:
                timestamp = self._normalize_datetime_string(
                    f"{event.get('date', '')} {event.get('time', '')}".strip()
                )
                description = event.get("description") or "Status updated"
                status_label = DHL_EVENT_CODE_MAP.get(event.get("event_code", ""), event.get("event_code", ""))
                history_item = {
                    "description": description,
                    "location": event.get("location", ""),
                    "status": status_label or description,
                    "date": timestamp or event.get("date", ""),
                }
                if "piece_ref" in event:
                    history_item["piece_ref"] = event["piece_ref"]
                history.append(history_item)

            history.sort(
                key=lambda item: self._history_sort_key(item.get("date", "")),
                reverse=True,
            )
            sorted_events = sorted(
                events,
                key=lambda ev: self._history_sort_key(
                    self._normalize_datetime_string(
                        f"{ev.get('date', '')} {ev.get('time', '')}".strip()
                    )
                    or ev.get("date", "")
                ),
                reverse=True,
            )
            latest = history[0]
            oldest = history[-1]
            latest_event_code = sorted_events[0].get("event_code", "") if sorted_events else ""
            current_status = latest.get("description") or "Unknown"
            estimated_delivery = _text_or_empty(payload_root.findtext("EstimatedDeliveryDate")) or None
            if estimated_delivery:
                estimated_delivery = self._normalize_datetime_string(estimated_delivery)[:10]

            status_bucket = self._to_status_bucket(current_status, event_code=latest_event_code)

            # Extract piece information if present (for Multi-Piece Shipments)
            child_parcels = []
            
            # Search for piece nodes broadly (PieceInfo, PieceDetails, or even just Piece)
            piece_nodes = (
                payload_root.findall(".//PieceInfo") + 
                payload_root.findall(".//PieceDetails") + 
                payload_root.findall(".//Piece")
            )
            
            # Check if there are any segmented events at all in the whole response
            has_any_segmented_events = any("piece_ref" in item for item in history)
            if not has_any_segmented_events:
                for piece_node in piece_nodes:
                    if (
                        piece_node.findall(".//PieceEvent") or
                        piece_node.findall(".//Event") or
                        piece_node.findall(".//ShipmentEvent")
                    ):
                        has_any_segmented_events = True
                        break

            for piece_node in piece_nodes:
                # Piece IDs can be in PieceID, LicensePlate, or PieceNumber tags
                p_id = (
                    _text_or_empty(piece_node.findtext("PieceID")) or 
                    _text_or_empty(piece_node.findtext("LicensePlate")) or
                    _text_or_empty(piece_node.findtext("PieceNumber")) or
                    _text_or_empty(piece_node.findtext("ID"))
                )
                
                if p_id:
                    # 1. Try to find piece-specific events nested under the piece node
                    p_events = []
                    p_event_nodes = (
                        piece_node.findall(".//PieceEvent") +
                        piece_node.findall(".//Event") +
                        piece_node.findall(".//ShipmentEvent")
                    )
                    for p_node in p_event_nodes:
                        pe_date = _text_or_empty(p_node.findtext("Date"))
                        pe_time = _text_or_empty(p_node.findtext("Time"))
                        pe_code = _text_or_empty(p_node.findtext("EventCode"))
                        pe_desc = _text_or_empty(p_node.findtext("Description"))
                        pe_loc = _text_or_empty(p_node.findtext("ServiceAreaDescription"))
                        if not pe_loc:
                            pe_loc = _text_or_empty(p_node.findtext("ServiceAreaCode"))
                        
                        if pe_date or pe_desc:
                            pe_timestamp = self._normalize_datetime_string(f"{pe_date} {pe_time}".strip())
                            pe_status_label = DHL_EVENT_CODE_MAP.get(pe_code, pe_code or pe_desc)
                            p_events.append({
                                "description": pe_desc or "Status updated",
                                "location": pe_loc,
                                "status": pe_status_label or pe_desc,
                                "date": pe_timestamp or pe_date,
                            })
                    
                    p_history = []
                    if p_events:
                        p_events.sort(key=lambda item: self._history_sort_key(item.get("date", "")), reverse=True)
                        p_history = p_events
                    else:
                        # 2. Try to filter the global history by matching piece_ref
                        p_history = [item for item in history if item.get("piece_ref") == p_id]
                    
                    # 3. Fallback to master history ONLY if there are no segmented events in the entire response
                    if not p_history and not has_any_segmented_events:
                        p_history = history
                    
                    # Determine piece-specific current status, date, location
                    if p_history and has_any_segmented_events:
                        # Synchronize master's newer events into child history if parent has moved
                        if history and history[0].get("date") and p_history[0].get("date"):
                            try:
                                m_date = datetime.fromisoformat(history[0]["date"].replace("Z", "+00:00"))
                                p_date = datetime.fromisoformat(p_history[0]["date"].replace("Z", "+00:00"))
                                if m_date > p_date:
                                    newer_scans = []
                                    for h_item in history:
                                        if h_item.get("date"):
                                            try:
                                                h_date = datetime.fromisoformat(h_item["date"].replace("Z", "+00:00"))
                                                if h_date > p_date:
                                                    newer_scans.append(h_item)
                                            except Exception:
                                                pass
                                    p_history = newer_scans + p_history
                            except Exception:
                                pass
                        p_desc = p_history[0]["description"]
                        p_bucket = p_history[0]["status"]
                        p_last_date = p_history[0]["date"]
                        p_last_location = p_history[0]["location"]
                    else:
                        p_desc = (
                            _text_or_empty(piece_node.findtext("LastDetailedStatus")) or 
                            _text_or_empty(piece_node.findtext("Description")) or 
                            (current_status if not has_any_segmented_events else "Pending")
                        )
                        p_bucket = self._to_status_bucket(p_desc)
                        p_last_date = latest.get("date") if (latest and not has_any_segmented_events) else None
                        p_last_location = latest.get("location") if (latest and not has_any_segmented_events) else None

                    child_parcels.append({
                        "tracking_number": p_id,
                        "status": p_bucket,
                        "raw_status": p_desc,
                        "carrier": "DHL",
                        "origin": oldest.get("location") or "Unknown",
                        "destination": "Unknown",
                        "eta": estimated_delivery or "Unknown",
                        "history": p_history,
                        "last_date": p_last_date,
                        "last_location": p_last_location,
                    })

            return {
                "current_status": current_status,
                "estimated_delivery": estimated_delivery,
                "last_location": latest.get("location") or None,
                "status": status_bucket,
                "eta": estimated_delivery or "Unknown",
                "history": history,
                "origin": oldest.get("location") or "Unknown",
                "destination": "Unknown",
                "progress": {
                    "Delivered": 100,
                    "Out for Delivery": 80,
                    "In Transit": 40,
                    "Exception": 10,
                }.get(status_bucket, 40),
                "child_parcels": child_parcels,
                "child_tracking_numbers": [p["tracking_number"] for p in child_parcels],
                "is_master": len(child_parcels) > 0,
            }

        # Some PostTracking responses only return summary fields.
        summary_description = _text_or_empty(payload_root.findtext("Description"))
        summary_code = _text_or_empty(payload_root.findtext("EventCode"))
        if summary_description or summary_code:
            location = self._extract_location_from_description(summary_description)
            status_bucket = self._to_status_bucket(summary_description or summary_code, event_code=summary_code)
            
            # Parse Date and Time from summary root if available to avoid missing scan dates
            summary_date = (
                _text_or_empty(payload_root.findtext("Date")) or 
                _text_or_empty(payload_root.findtext("EventDate")) or 
                _text_or_empty(payload_root.findtext("DateOfScan")) or 
                _text_or_empty(payload_root.findtext("ScanDate")) or 
                ""
            )
            summary_time = (
                _text_or_empty(payload_root.findtext("Time")) or 
                _text_or_empty(payload_root.findtext("EventTime")) or 
                _text_or_empty(payload_root.findtext("TimeOfScan")) or 
                _text_or_empty(payload_root.findtext("ScanTime")) or 
                ""
            )
            summary_timestamp = ""
            if summary_date:
                summary_timestamp = self._normalize_datetime_string(f"{summary_date} {summary_time}".strip())

            return {
                "current_status": summary_description or summary_code,
                "estimated_delivery": None,
                "last_location": location,
                "status": status_bucket,
                "eta": "Unknown",
                "history": [
                    {
                        "description": summary_description or summary_code,
                        "location": location or "",
                        "status": DHL_EVENT_CODE_MAP.get(summary_code, summary_code or summary_description or ""),
                        "date": summary_timestamp or summary_date,
                    }
                ],
                "origin": "Unknown",
                "destination": "Unknown",
                "progress": {
                    "Delivered": 100,
                    "Out for Delivery": 80,
                    "In Transit": 40,
                    "Exception": 10,
                }.get(status_bucket, 40),
            }

        return None

    def _xml_to_dict(self, element: ET.Element) -> Any:
        children = list(element)
        if not children:
            return _text_or_empty(element.text)

        result: dict[str, Any] = {}
        for child in children:
            key = _local_name(child.tag)
            value = self._xml_to_dict(child)
            if key in result:
                existing = result[key]
                if not isinstance(existing, list):
                    result[key] = [existing, value]
                else:
                    existing.append(value)
            else:
                result[key] = value
        return result

    def _extract_events(self, payload_data: Any) -> list[dict[str, Any]]:
        events: list[dict[str, Any]] = []

        def walk(node: Any) -> None:
            if isinstance(node, dict):
                lower_keys = {k.lower() for k in node}
                has_status = any("status" in key or "description" in key for key in lower_keys)
                has_date = any("date" in key for key in lower_keys)
                has_time = any("time" in key for key in lower_keys)
                has_location = any(
                    any(token in key for token in ("location", "city", "facility", "hub"))
                    for key in lower_keys
                )
                if has_status and (has_location or (has_date and has_time)):
                    events.append(node)
                for value in node.values():
                    walk(value)
            elif isinstance(node, list):
                for item in node:
                    walk(item)

        walk(payload_data)
        return events

    def _pick_latest_event(self, events: list[dict[str, Any]]) -> dict[str, Any]:
        if not events:
            return {}

        def sort_key(event: dict[str, Any]) -> tuple[int, str]:
            dt = self._extract_event_datetime(event)
            if dt:
                return (2, dt)
            # fallback: string match for stable ordering
            fallback = _text_or_empty(event.get("EventDate") or event.get("Date"))
            return (1, fallback)

        return sorted(events, key=sort_key, reverse=True)[0]

    def _extract_event_datetime(self, event: dict[str, Any]) -> str:
        date_value = self._first_non_empty(
            event,
            [
                "EventDateTime",
                "EventDatetime",
                "EventDate",
                "StatusDateTime",
                "StatusDate",
                "DateTime",
                "Date",
                "Timestamp",
            ],
        )
        time_value = self._first_non_empty(event, ["EventTime", "Time"])

        if date_value and time_value and "T" not in date_value:
            combined = f"{date_value} {time_value}"
        else:
            combined = date_value

        return self._normalize_datetime_string(combined)

    def _extract_status(self, event: dict[str, Any], payload_data: dict[str, Any]) -> str:
        status = self._first_non_empty(
            event,
            [
                "EventDescription",
                "Description",
                "StatusDescription",
                "ShipmentStatus",
                "Status",
                "ActionStatus",
            ],
        )
        if status:
            return status

        payload_status = self._first_non_empty(
            payload_data,
            [
                "LatestStatus",
                "ShipmentStatus",
                "StatusDescription",
                "Status",
                "ActionStatus",
            ],
        )
        return payload_status or "Unknown"

    def _extract_estimated_delivery(self, payload_data: dict[str, Any]) -> str | None:
        value = self._first_non_empty(
            payload_data,
            [
                "EstimatedDeliveryDate",
                "EstimatedDateOfDelivery",
                "ExpectedDeliveryDate",
                "ExpectedDateOfDelivery",
                "DeliveryDate",
                "ETA",
            ],
        )
        if not value:
            return None
        normalized = self._normalize_datetime_string(value)
        return normalized[:10] if normalized else value[:10]

    def _extract_location(self, event: dict[str, Any], payload_data: dict[str, Any]) -> str | None:
        location = self._first_non_empty(
            event,
            [
                "EventLocation",
                "CheckpointLocation",
                "Location",
                "Facility",
                "Hub",
                "City",
            ],
        )
        if location:
            return location

        payload_location = self._first_non_empty(payload_data, ["LastLocation", "Location", "City"])
        return payload_location or None

    def _first_non_empty(self, payload: Any, aliases: list[str]) -> str:
        if isinstance(payload, dict):
            alias_map = {k.lower(): k for k in payload.keys()}
            for alias in aliases:
                key = alias_map.get(alias.lower())
                if key is not None:
                    candidate = payload[key]
                    if isinstance(candidate, dict):
                        nested = self._first_non_empty(
                            candidate,
                            ["Description", "Status", "Value", "Name", "City", "Location"],
                        )
                        if nested:
                            return nested
                    elif isinstance(candidate, list):
                        for item in candidate:
                            nested = self._first_non_empty(
                                item,
                                ["Description", "Status", "Value", "Name", "City", "Location"],
                            )
                            if nested:
                                return nested
                    else:
                        text = _text_or_empty(candidate)
                        if text:
                            return text

            for value in payload.values():
                nested = self._first_non_empty(value, aliases)
                if nested:
                    return nested

        elif isinstance(payload, list):
            for item in payload:
                nested = self._first_non_empty(item, aliases)
                if nested:
                    return nested

        return ""

    def _normalize_datetime_string(self, raw_value: str) -> str:
        raw = _text_or_empty(raw_value)
        if not raw:
            return ""

        candidates = [raw]
        if "T" in raw and raw.endswith("Z"):
            candidates.append(raw.replace("Z", "+00:00"))
        if "/" in raw and " " not in raw:
            candidates.extend(
                [
                    raw + " 00:00:00",
                ]
            )

        known_formats = (
            "%Y-%m-%d %H:%M:%S",
            "%Y-%m-%d %H:%M",
            "%Y-%m-%d",
            "%d-%m-%Y %H:%M:%S",
            "%d-%m-%Y",
            "%d/%m/%Y %H:%M:%S",
            "%d/%m/%Y",
            "%m/%d/%Y %H:%M:%S",
            "%m/%d/%Y",
        )

        for candidate in candidates:
            try:
                dt = datetime.fromisoformat(candidate)
                return dt.isoformat()
            except ValueError:
                pass
            for fmt in known_formats:
                try:
                    dt = datetime.strptime(candidate, fmt)
                    return dt.isoformat()
                except ValueError:
                    continue
        return raw

    def _history_sort_key(self, value: str) -> tuple[int, str]:
        token = _text_or_empty(value)
        if not token:
            return (0, "")
        normalized = token.replace("Z", "+00:00")
        try:
            return (2, datetime.fromisoformat(normalized).isoformat())
        except ValueError:
            pass
        return (1, token)

    def _extract_location_from_description(self, text: str) -> str | None:
        description = _text_or_empty(text)
        if not description:
            return None

        # DHL summary descriptions often end in a location token:
        # "Arrived at DHL Delivery Facility LAS VEGAS,NV-USA"
        patterns = [
            r"facility\s+([A-Z][A-Z0-9\s\-\(\)\/]+,[A-Z]{2,}-[A-Z]{2,})$",
            r"at\s+([A-Z][A-Z0-9\s\-\(\)\/]+,[A-Z]{2,}-[A-Z]{2,})$",
        ]
        for pattern in patterns:
            match = re.search(pattern, description, flags=re.IGNORECASE)
            if match:
                return match.group(1).strip()
        return None

    def _to_status_bucket(self, raw_status: str, event_code: str = "") -> str:
        # Define Code Sets
        EXCEPTION_CODES = {"OH", "RD", "BA", "CD", "CR", "NH", "WX", "PY"}
        DELIVERED_CODES = {"OK"}
        OUT_FOR_DELIVERY_CODES = {"WC"}
        IN_TRANSIT_CODES = {"AF", "DF", "PL", "AR", "DP"}

        code = _text_or_empty(event_code).upper().strip()
        status = _text_or_empty(raw_status).lower()

        # Handle the CD (Clearance Delay/Event) quirk
        if code == "CD":
            if "clearance event" in status and "delay" not in status:
                return "In Transit"
            return "Exception"

        # Primary Code Check for other codes
        if code in EXCEPTION_CODES:
            return "Exception"
        if code in DELIVERED_CODES:
            return "Delivered"
        if code in OUT_FOR_DELIVERY_CODES:
            return "Out for Delivery"
        if code in IN_TRANSIT_CODES:
            return "In Transit"

        # Special overrides to bypass all text-based exception logic
        if "with delivery courier" in status:
            return "Out for Delivery"

        movement_words = ["departed", "processed", "forwarded", "released", "resolved", "cleared"]
        if any(word in status for word in movement_words):
            return "In Transit"

        # Exception check with strict word boundaries
        exception_patterns = [
            r"\bexception\w*\b",
            r"\bhold\w*\b",
            r"\bheld\b",
            r"\bdelay\w*\b",
            r"\breturn\w*\b",
            r"\bundeliver\w*\b",
            r"\battempt\w*\b",
        ]
        for pattern in exception_patterns:
            if re.search(pattern, status):
                return "Exception"

        # Out for delivery check
        out_for_delivery_words = ("out for delivery", "with delivery courier", "with courier")
        for word in out_for_delivery_words:
            pattern = rf"\b{re.escape(word)}\b"
            if re.search(pattern, status):
                return "Out for Delivery"

        # Delivered check
        delivered_markers = (
            "shipment delivered",
            "delivery successful",
            "delivered - signed for",
            "proof of delivery",
            "delivered",
        )
        has_delivered = False
        for marker in delivered_markers:
            if marker == "delivered":
                pattern = r"\bdelivered\b"
            else:
                pattern = rf"\b{re.escape(marker)}\b"
            if re.search(pattern, status):
                has_delivered = True
                break

        if has_delivered:
            in_progress_exclusions = ("delivery facility", "out for delivery", "scheduled for delivery", "attempted")
            has_exclusion = False
            for exclusion in in_progress_exclusions:
                pattern = rf"\b{re.escape(exclusion)}\b"
                if re.search(pattern, status):
                    has_exclusion = True
                    break
            if not has_exclusion:
                return "Delivered"

        return "In Transit"
