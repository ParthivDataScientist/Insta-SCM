from __future__ import annotations

import base64
import html
import json
import logging
import re
import xml.etree.ElementTree as ET
from typing import Any

import requests

from app.core.config import settings

logger = logging.getLogger(__name__)


def _local_name(tag: str) -> str:
    if "}" in tag:
        return tag.split("}", 1)[1]
    return tag


def _text(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return value.strip()
    return str(value).strip()


def _redact_xml_for_log(xml: str) -> str:
    redacted = re.sub(
        r"(<(?:[^:>]+:)?(?:Password|SitePassword|DutyAccNumber|ShipperAccNumber|BillingAccNumber)>).*?(</(?:[^:>]+:)?(?:Password|SitePassword|DutyAccNumber|ShipperAccNumber|BillingAccNumber)>)",
        r"\1***REDACTED***\2",
        xml,
        flags=re.IGNORECASE,
    )
    return re.sub(
        r"(<(?:[^:>]+:)?(?:LabelImage|LabelPDF|LabelData|ShipmentLabel|Label)>).*?(</(?:[^:>]+:)?(?:LabelImage|LabelPDF|LabelData|ShipmentLabel|Label)>)",
        r"\1***REDACTED_LABEL***\2",
        redacted,
        flags=re.IGNORECASE | re.DOTALL,
    )


class DHLBookingProvider:
    SOAP11_ENVELOPE_NS = "http://schemas.xmlsoap.org/soap/envelope/"
    ACTION_POST_QUOTE = "http://tempuri.org/IDHLService/PostQuotePos_V6"
    ACTION_POST_QUOTE_LEGACY = "http://tempuri.org/IDHLService/PostQuote"
    ACTION_POST_SHIPMENT = "http://tempuri.org/IDHLService/PostShipment_V6"
    ACTION_POST_PICKUP = "http://tempuri.org/IDHLService/PostPickup_v6"

    def __init__(self) -> None:
        self.endpoint = settings.DHL_WCF_ENDPOINT
        self.soap_version = settings.DHL_WCF_SOAP_VERSION
        self.timeout_seconds = settings.DHL_WCF_TIMEOUT_SECONDS
        self.transport_username = settings.DHL_WCF_USERNAME
        self.transport_password = settings.DHL_WCF_PASSWORD
        self.site_id = settings.DHL_SITE_ID or settings.DHL_WCF_USERNAME
        self.site_password = settings.DHL_WCF_PASSWORD

    def rate(self, payload: dict[str, Any]) -> dict[str, Any]:
        raw = self._invoke(
            operation="PostQuotePos_V6",
            action=self.ACTION_POST_QUOTE,
            result_node="PostQuotePos_V6Result",
            fields=payload,
        )
        if raw.get("error"):
            logger.warning(
                "dhl_quote_v6_failed_falling_back_to_legacy error=%s",
                raw["error"],
            )
            legacy_fields = {k: v for k, v in payload.items() if k != "SpecialService"}
            raw = self._invoke(
                operation="PostQuote",
                action=self.ACTION_POST_QUOTE_LEGACY,
                result_node="PostQuoteResult",
                fields=legacy_fields,
            )
        if raw.get("error"):
            return raw
        parsed = self._parse_quote_payload(raw["payload"])
        if parsed.get("error"):
            return parsed
        return parsed

    def create_shipment(self, payload: dict[str, Any]) -> dict[str, Any]:
        raw = self._invoke(
            operation="PostShipment_V6",
            action=self.ACTION_POST_SHIPMENT,
            result_node="PostShipment_V6Result",
            fields=payload,
        )
        if raw.get("error"):
            return raw
        parsed = self._parse_create_payload(raw["payload"])
        if parsed.get("error"):
            return parsed
        return parsed

    def schedule_pickup(self, payload: dict[str, Any]) -> dict[str, Any]:
        raw = self._invoke(
            operation="PostPickup_v6",
            action=self.ACTION_POST_PICKUP,
            result_node="PostPickup_v6Result",
            fields=payload,
        )
        if raw.get("error"):
            return raw
        parsed = self._parse_pickup_payload(raw["payload"])
        if parsed.get("error"):
            return parsed
        return parsed

    def _invoke(
        self,
        *,
        operation: str,
        action: str,
        result_node: str,
        fields: dict[str, Any],
    ) -> dict[str, Any]:
        envelope = self._build_envelope(operation=operation, fields=fields)
        headers = self._build_headers(action=action)

        logger.info("dhl_booking_request operation=%s body=%s", operation, _redact_xml_for_log(envelope))

        try:
            response = requests.post(
                self.endpoint,
                data=envelope.encode("utf-8"),
                headers=headers,
                timeout=self.timeout_seconds,
            )
        except requests.RequestException as exc:
            logger.error("dhl_booking_request_failed operation=%s error=%s", operation, exc)
            return {"error": f"DHL SOAP Request Failed: {exc}"}

        logger.info(
            "dhl_booking_response operation=%s status_code=%s body=%s",
            operation,
            response.status_code,
            _redact_xml_for_log(response.text),
        )

        if response.status_code >= 400:
            detail = self._extract_fault_message(response.text) or f"HTTP {response.status_code}"
            return {"error": f"DHL SOAP Error: {detail}"}

        return self._extract_result_payload(response.text, result_node=result_node)

    def _build_headers(self, *, action: str) -> dict[str, str]:
        if self.soap_version == "1.2":
            headers = {
                "Content-Type": f'application/soap+xml; charset=utf-8; action="{action}"',
            }
        else:
            headers = {
                "Content-Type": "text/xml; charset=utf-8",
                "SOAPAction": f'"{action}"',
            }

        if self.transport_username and self.transport_password:
            token = base64.b64encode(
                f"{self.transport_username}:{self.transport_password}".encode("utf-8")
            ).decode("ascii")
            headers["Authorization"] = f"Basic {token}"
        return headers

    def _build_envelope(self, *, operation: str, fields: dict[str, Any]) -> str:
        nodes: list[str] = []
        for name, value in fields.items():
            text = _text(value)
            if text == "":
                continue
            nodes.append(f"<tem:{name}>{html.escape(text)}</tem:{name}>")

        inner = "".join(nodes)
        return (
            '<?xml version="1.0" encoding="utf-8"?>'
            '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" '
            'xmlns:tem="http://tempuri.org/">'
            "<soapenv:Header/>"
            "<soapenv:Body>"
            f"<tem:{operation}>"
            f"{inner}"
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
        return _text(
            fault_node.findtext(".//{*}faultstring") or fault_node.findtext(".//{*}Text") or ""
        )

    def _extract_result_payload(self, soap_xml: str, *, result_node: str) -> dict[str, Any]:
        try:
            root = ET.fromstring(soap_xml)
        except ET.ParseError as exc:
            return {"error": f"Failed to parse DHL SOAP envelope: {exc}"}

        fault = self._extract_fault_message(soap_xml)
        if fault:
            return {"error": f"DHL SOAP Error: {fault}"}

        result = root.find(f".//{{*}}{result_node}")
        if result is None:
            return {"error": f"DHL SOAP response missing {result_node}"}

        payload = html.unescape(_text(result.text))
        if not payload:
            return {"error": "Empty DHL SOAP payload"}
        return {"payload": payload}

    def _parse_payload_root(self, payload: str) -> ET.Element | None:
        token = _text(payload)
        if not token or not token.startswith("<"):
            return None
        try:
            return ET.fromstring(token)
        except ET.ParseError:
            decoded = html.unescape(token)
            try:
                return ET.fromstring(decoded)
            except ET.ParseError:
                return None

    def _parse_quote_payload(self, payload: str) -> dict[str, Any]:
        root = self._parse_payload_root(payload)
        if root is None:
            return self._parse_quote_text(payload)

        condition_data = self._find_first_text(root, ["ConditionData"])
        if condition_data:
            return {"error": condition_data}

        error = self._extract_embedded_error(root)
        if error:
            return {"error": error}

        amount_text = self._find_first_text(
            root,
            [
                "TotalAmount",
                "Amount",
                "ChargeValue",
                "ShippingCharge",
                "QuotedCharge",
                "QuoteAmount",
            ],
        )
        tax_text = self._find_first_text(
            root,
            [
                "TotalTaxAmount",
                "TaxAmount",
                "Tax",
            ],
        )
        currency = self._find_first_text(
            root,
            [
                "CurrencyCode",
                "Currency",
                "ChargeCurrency",
                "QuotedCurrency",
            ],
        )
        delivery = self._find_first_text(
            root,
            [
                "DeliveryDate",
                "DeliveryDateTime",
                "EstimatedDeliveryDate",
                "TransitDays",
                "DeliveryTime",
            ],
        )

        amount = self._extract_number(amount_text)
        tax_amount = self._extract_number(tax_text)
        if amount is not None and tax_amount is not None and "totalamount" not in payload.lower():
            amount += tax_amount
        if amount is None:
            return {"error": "Unable to parse DHL rate amount"}

        return {
            "price": amount,
            "currency": currency or self._default_quote_currency(),
            "delivery_time": delivery or None,
        }

    def _parse_quote_text(self, payload: str) -> dict[str, Any]:
        amount = self._extract_number(payload)
        if amount is None:
            return {"error": f"Unable to parse DHL rate payload: {payload}"}

        currency_match = re.search(r"\b([A-Z]{3})\b", payload)
        delivery_match = re.search(
            r"(delivery[^,;]+|transit[^,;]+|\d+\s*(day|days|hour|hours))",
            payload,
            flags=re.IGNORECASE,
        )
        return {
            "price": amount,
            "currency": currency_match.group(1) if currency_match else self._default_quote_currency(),
            "delivery_time": delivery_match.group(1) if delivery_match else None,
        }

    def _default_quote_currency(self) -> str:
        shipper_country = _text(settings.DHL_SHIPPER_COUNTRY_CODE).upper()
        if shipper_country == "IN":
            return "INR"
        return settings.DHL_DEFAULT_DECLARED_CURRENCY

    def _parse_create_payload(self, payload: str) -> dict[str, Any]:
        root = self._parse_payload_root(payload)
        if root is None:
            return {"error": f"Unable to parse DHL shipment payload: {payload}"}

        condition_data = self._find_first_text(root, ["ConditionData"])
        if condition_data:
            return {"error": condition_data}

        error = self._extract_embedded_error(root)
        if error:
            return {"error": error}

        awb = self._find_first_text(
            root,
            [
                "AirwayBillNumber",
                "AWBNumber",
                "WayBillNumber",
                "ShipmentNumber",
                "TrackingNumber",
            ],
        )
        label = self._find_first_text(
            root,
            [
                "LabelImage",
                "LabelPDF",
                "LabelData",
                "ShipmentLabel",
                "Label",
            ],
        )

        if not awb:
            return {"error": "DHL shipment creation response did not contain an AWB"}
        if not label:
            return {"error": "DHL shipment creation response did not contain a label"}

        return {"awb": awb, "label_base64": label, "raw_payload": payload}

    def _parse_pickup_payload(self, payload: str) -> dict[str, Any]:
        root = self._parse_payload_root(payload)
        if root is None:
            pickup_id = _text(payload)
            if not pickup_id:
                return {"error": "Unable to parse DHL pickup payload"}
            return {"pickup_id": pickup_id, "pickup_status": "SCHEDULED"}

        error = self._extract_embedded_error(root)
        if error:
            return {"error": error}

        pickup_id = self._find_first_text(
            root,
            [
                "PickupRequestNumber",
                "PickupConfirmationNumber",
                "ConfirmationNumber",
                "PickupID",
                "RequestNumber",
                "PickupRefNo",
            ],
        )
        pickup_status = self._find_first_text(
            root,
            [
                "PickupStatus",
                "Status",
                "ResponseStatus",
                "ConfirmationStatus",
            ],
        )

        if not pickup_id:
            return {"error": "DHL pickup response did not contain a pickup identifier"}

        return {
            "pickup_id": pickup_id,
            "pickup_status": pickup_status or "SCHEDULED",
            "raw_payload": payload,
        }

    def _find_first_text(self, root: ET.Element, names: list[str]) -> str:
        wanted = {name.lower() for name in names}
        for node in root.iter():
            if _local_name(node.tag).lower() in wanted:
                value = _text(node.text)
                if value:
                    return value
        return ""

    def _extract_embedded_error(self, root: ET.Element) -> str:
        for name in ("Error", "ErrorMessage", "Message", "ResponseMessage", "StatusMessage"):
            value = self._find_first_text(root, [name])
            if value and "success" not in value.lower():
                if "error" in value.lower() or "fail" in value.lower() or "invalid" in value.lower():
                    return value

        for node in root.iter():
            text = _text(node.text)
            if text and any(token in text.lower() for token in ("error", "failed", "invalid")):
                if len(text) <= 240:
                    return text
        return ""

    def _extract_number(self, raw_value: str) -> float | None:
        token = _text(raw_value)
        if not token:
            return None

        if token.startswith("{"):
            try:
                data = json.loads(token)
            except json.JSONDecodeError:
                data = None
            if isinstance(data, dict):
                for value in data.values():
                    number = self._extract_number(value)
                    if number is not None:
                        return number

        match = re.search(r"(-?\d+(?:\.\d+)?)", token.replace(",", ""))
        if not match:
            return None
        try:
            return float(match.group(1))
        except ValueError:
            return None
