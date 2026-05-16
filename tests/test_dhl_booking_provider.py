import html

from app.services.dhl_booking_provider import DHLBookingProvider
from app.services.shipment_service import _build_dhl_shipment_payload, _dhl_shipper_defaults


class _MockResponse:
    def __init__(self, status_code: int, text: str):
        self.status_code = status_code
        self.text = text


def _wrap_soap(payload: str, result_node: str) -> str:
    escaped = html.escape(payload)
    return (
        '<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/">'
        "<s:Body>"
        f'<Response xmlns="http://tempuri.org/"><{result_node}>{escaped}</{result_node}></Response>'
        "</s:Body>"
        "</s:Envelope>"
    )


def _wrap_fault(message: str) -> str:
    return (
        '<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/">'
        "<s:Body>"
        "<s:Fault>"
        "<faultcode>s:Server</faultcode>"
        f"<faultstring>{html.escape(message)}</faultstring>"
        "</s:Fault>"
        "</s:Body>"
        "</s:Envelope>"
    )


def test_rate_falls_back_to_legacy_postquote_when_v6_faults(monkeypatch):
    provider = DHLBookingProvider()
    responses = [
        _MockResponse(
            status_code=500,
            text=_wrap_fault("Object reference not set to an instance of an object."),
        ),
        _MockResponse(
            status_code=200,
            text=_wrap_soap(
                '<?xml version="1.0" encoding="utf-8"?><Details><ShippingCharge>22950.770</ShippingCharge><TotalTaxAmount>3500.960</TotalTaxAmount></Details>',
                "PostQuoteResult",
            ),
        ),
    ]

    def fake_post(*args, **kwargs):
        return responses.pop(0)

    monkeypatch.setattr("app.services.dhl_booking_provider.requests.post", fake_post)

    result = provider.rate(
        {
            "ShipperPostCode": "401208",
            "ReceiverCountryCode": "AE",
            "PostCode": "00000",
            "fromCity": "Mumbai",
            "IsDutiable": "Y",
            "PickupHours": "15",
            "PickupMinutes": "00",
            "DeclaredCurrency": "USD",
            "DeclaredValue": "2500",
            "GlobalProductCode": "P",
            "LocalProductCode": "P",
            "toCity": "Dubai",
            "PaymentAccountNumber": "531429677",
            "pieces": 2,
            "ShipPieceWt": "18.5",
            "ShipPieceDepth": "80",
            "ShipPieceWidth": "60",
            "ShipPieceHeight": "45",
        }
    )

    assert result["price"] == 26451.73
    assert result["currency"] == "INR"


def test_rate_parser_does_not_read_xml_version_as_amount():
    provider = DHLBookingProvider()
    result = provider._parse_quote_text(
        '<?xml version="1.0" encoding="utf-8"?><Details><ConditionData>No rate found</ConditionData></Details>'
    )

    assert "error" in result


def test_rate_parser_reads_amount_from_malformed_xmlish_payload():
    provider = DHLBookingProvider()
    result = provider._parse_quote_text(
        '<?xml version="1.0" encoding="utf-8"?><Details><ShippingCharge>22950.770</ShippingCharge><TotalTaxAmount>3500.960</TotalTaxAmount>'
    )

    assert result["price"] == 26451.73
    assert result["currency"] == "INR"


def test_create_shipment_returns_condition_data_as_error():
    provider = DHLBookingProvider()
    result = provider._parse_create_payload(
        '<?xml version="1.0" encoding="UTF-8"?>'
        "<ConditionData>Duty Account Number is not acceptable for Duty Payment Type is R</ConditionData>"
    )

    assert result["error"] == "Duty Account Number is not acceptable for Duty Payment Type is R"


def test_create_shipment_returns_plain_dhl_exception_as_error():
    provider = DHLBookingProvider()
    message = "Object reference not set to an instance of an object. Exception - Please contact to support team regarding this issue"
    result = provider._parse_create_payload(message)

    assert result["error"] == message


def test_create_shipment_sends_empty_tags_for_wcf_methods(monkeypatch):
    provider = DHLBookingProvider()
    captured = {}

    def fake_invoke(**kwargs):
        captured.update(kwargs)
        return {"payload": "<Root><AWBNumber>1234567890</AWBNumber><LabelPDF>QUJD</LabelPDF></Root>"}

    monkeypatch.setattr(provider, "_invoke", fake_invoke)

    result = provider.create_shipment({"Required": "value", "Optional": ""}, shipment_type="CSB_V")

    assert result["awb"] == "1234567890"
    assert captured["include_empty_fields"] is True


def test_dhl_shipper_address_lines_are_limited(monkeypatch):
    monkeypatch.setattr(
        "app.services.shipment_service.settings.DHL_SHIPPER_ADDRESS1",
        "1001, 10th Floor, Kohinoor Continental, J.B Nagar, Andheri-Kurla Road",
    )
    monkeypatch.setattr("app.services.shipment_service.settings.DHL_SHIPPER_ADDRESS2", "")
    monkeypatch.setattr("app.services.shipment_service.settings.DHL_SHIPPER_ADDRESS3", "")

    shipper = _dhl_shipper_defaults()

    assert shipper["address1"] == "1001, 10th Floor, Kohinoor Continental, J.B"
    assert shipper["address2"] == "Nagar, Andheri-Kurla Road"
    assert len(shipper["address1"]) <= 45
    assert len(shipper["address2"]) <= 45
    assert len(shipper["address3"]) <= 45


def test_shipment_payload_uses_csbv_fields(monkeypatch):
    monkeypatch.setattr("app.services.shipment_service.settings.DHL_DUTY_ACCOUNT_NUMBER", "DUTY123")
    monkeypatch.setattr("app.services.shipment_service.settings.DHL_SHIPPER_ACCOUNT_NUMBER", "SHIPPER123")
    monkeypatch.setattr("app.services.shipment_service.settings.DHL_BILLING_ACCOUNT_NUMBER", "SHIPPER123")
    monkeypatch.setattr("app.services.shipment_service.settings.DHL_SITE_ID", "SITE123")
    monkeypatch.setattr("app.services.shipment_service.settings.DHL_WCF_PASSWORD", "secret")
    monkeypatch.setattr(
        "app.services.shipment_service._dhl_shipper_defaults",
        lambda: {
            "company": "Insta Exhibition",
            "name": "Insta Exhibition",
            "address1": "Andheri",
            "address2": "Kurla Road",
            "address3": "",
            "city": "Mumbai",
            "postal_code": "400059",
            "country_code": "IN",
            "country_name": "India",
            "phone": "7977572486",
            "state_code": "27",
            "state_name": "Maharashtra",
        },
    )

    payload = _build_dhl_shipment_payload(
        {
            "receiver": {
                "company_name": "Tech Showcase Ltd",
                "name": "John Doe",
                "email": "test@example.com",
                "phone": "+1 5550123456",
                "address_line1": "123 Innovation Way",
                "address_line2": "",
                "address_line3": "",
                "city": "New York",
                "state_code": "NY",
                "postal_code": "10001",
                "country_code": "US",
                "country_name": "United States",
            },
            "package": {
                "pieces": 1,
                "weight_kg": 100,
                "length_cm": 20,
                "width_cm": 20,
                "height_cm": 20,
                "declared_value": 10,
                "declared_currency": "USD",
            },
            "shipment": {
                "description": "Exhibition Sample",
                "duty_payment_type": "R",
            },
            "commercial": {
                "iec_no": "ABOPK6898D",
                "gstin": "27AAACK4000B1ZY",
                "bank_ad_code": "6390300",
                "invoice_number": "INV-001",
                "invoice_date": "2026-05-01",
                "hs_code": "61091000",
                "commodity_code": "6109100010",
                "commodity_type": "Others",
                "invoice_rate_per_unit": 10,
                "quantity": 1,
                "uom": "PCS",
            },
        }
    )

    assert payload["Shipmentpurpose"] == "CSBV"
    assert payload["SiteId"] == "SITE123"
    assert payload["IECNo"] == "ABOPK6898D"
    assert payload["GSTIN"] == "27AAACK4000B1ZY"
    assert payload["Usingecommerce"] == "0"
    assert payload["IsUsingIGST"] == "No"
    assert payload["UsingBondorUT"] == "Yes"
    assert payload["Description"] == "1Exhibition Sample"
    assert payload["HSCode"] == "61091000"
    assert payload["CommodityCode"] == "6109100010"
    assert payload["SpecialService"] == "DS"
    assert payload["IsResponseRequired"] == "Y"
    assert payload["LabelReq"] == "Y"


def test_shipment_payload_can_use_normal_postshipment(monkeypatch):
    monkeypatch.setattr("app.services.shipment_service.settings.DHL_DUTY_ACCOUNT_NUMBER", "DUTY123")
    monkeypatch.setattr("app.services.shipment_service.settings.DHL_SHIPPER_ACCOUNT_NUMBER", "SHIPPER123")
    monkeypatch.setattr("app.services.shipment_service.settings.DHL_BILLING_ACCOUNT_NUMBER", "SHIPPER123")
    monkeypatch.setattr("app.services.shipment_service.settings.DHL_SITE_ID", "SITE123")
    monkeypatch.setattr("app.services.shipment_service.settings.DHL_WCF_PASSWORD", "secret")
    monkeypatch.setattr(
        "app.services.shipment_service._dhl_shipper_defaults",
        lambda: {
            "company": "Insta Exhibition",
            "name": "Insta Exhibition",
            "address1": "Andheri",
            "address2": "Kurla Road",
            "address3": "",
            "city": "Mumbai",
            "postal_code": "400059",
            "country_code": "IN",
            "country_name": "India",
            "phone": "7977572486",
        },
    )

    payload = _build_dhl_shipment_payload(
        {
            "receiver": {
                "company_name": "Tech Showcase Ltd",
                "name": "John Doe",
                "email": "test@example.com",
                "phone": "+1 5550123456",
                "address_line1": "123 Innovation Way",
                "address_line2": "",
                "address_line3": "",
                "city": "New York",
                "state_code": "NY",
                "postal_code": "10001",
                "country_code": "US",
                "country_name": "United States",
            },
            "package": {
                "pieces": 1,
                "weight_kg": 100,
                "length_cm": 20,
                "width_cm": 20,
                "height_cm": 20,
                "declared_value": 10,
                "declared_currency": "USD",
            },
            "shipment": {
                "shipment_type": "NORMAL",
                "description": "Exhibition Sample",
                "duty_payment_type": "R",
            },
        }
    )

    assert "Shipmentpurpose" not in payload
    assert payload["DutyPaymentType"] == "R"
    assert payload["DutyAccNumber"] == ""
    assert payload["LabelReq"] == "Y"


def test_shipment_payload_can_use_csbiv_cargo(monkeypatch):
    monkeypatch.setattr("app.services.shipment_service.settings.DHL_DUTY_ACCOUNT_NUMBER", "DUTY123")
    monkeypatch.setattr("app.services.shipment_service.settings.DHL_SHIPPER_ACCOUNT_NUMBER", "SHIPPER123")
    monkeypatch.setattr("app.services.shipment_service.settings.DHL_BILLING_ACCOUNT_NUMBER", "SHIPPER123")
    monkeypatch.setattr("app.services.shipment_service.settings.DHL_SITE_ID", "SITE123")
    monkeypatch.setattr("app.services.shipment_service.settings.DHL_WCF_PASSWORD", "secret")
    monkeypatch.setattr(
        "app.services.shipment_service._dhl_shipper_defaults",
        lambda: {
            "company": "Insta Exhibition",
            "name": "Insta Exhibition",
            "address1": "Andheri",
            "address2": "Kurla Road",
            "address3": "",
            "city": "Mumbai",
            "postal_code": "400059",
            "country_code": "IN",
            "country_name": "India",
            "phone": "7977572486",
            "state_code": "27",
            "state_name": "Maharashtra",
        },
    )

    payload = _build_dhl_shipment_payload(
        {
            "receiver": {
                "company_name": "Tech Showcase Ltd",
                "name": "John Doe",
                "email": "test@example.com",
                "phone": "+1 5550123456",
                "address_line1": "123 Innovation Way",
                "address_line2": "",
                "address_line3": "",
                "city": "New York",
                "state_code": "NY",
                "postal_code": "10001",
                "country_code": "US",
                "country_name": "United States",
            },
            "package": {
                "pieces": 1,
                "weight_kg": 100,
                "length_cm": 20,
                "width_cm": 20,
                "height_cm": 20,
                "declared_value": 10,
                "declared_currency": "USD",
            },
            "shipment": {
                "shipment_type": "CSB_IV_CARGO",
                "description": "Exhibition Sample",
                "duty_payment_type": "R",
            },
            "commercial": {
                "gstin": "27AAACK4000B1ZY",
                "invoice_number": "INV-001",
                "invoice_date": "2026-05-01",
                "hs_code": "61091000",
                "commodity_code": "6109100010",
                "invoice_rate_per_unit": 10,
                "quantity": 1,
            },
        }
    )

    assert payload["Shipmentpurpose"] == "CSBIV"
    assert payload["DutyPaymentType"] == "R"
    assert payload["NonGSTInvNo"] == "INV-001"
    assert payload["GSTInvNo"] == ""
    assert payload["IsUsingIGST"] == "NA"
    assert payload["ReasonForExport"] == "Sample"


def test_create_shipment_selects_requested_operation(monkeypatch):
    provider = DHLBookingProvider()
    captured = {}

    def fake_invoke(**kwargs):
        captured.update(kwargs)
        return {"payload": "<Root><AWBNumber>1234567890</AWBNumber><LabelPDF>QUJD</LabelPDF></Root>"}

    monkeypatch.setattr(provider, "_invoke", fake_invoke)

    result = provider.create_shipment({"Any": "Value"}, shipment_type="CSB_IV_CARGO")

    assert result["awb"] == "1234567890"
    assert captured["operation"] == "PostShipment_CSBIV_Cargo"
    assert captured["result_node"] == "PostShipment_CSBIV_CargoResult"
