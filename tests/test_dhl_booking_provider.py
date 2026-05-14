import html

from app.services.dhl_booking_provider import DHLBookingProvider
from app.services.shipment_service import _build_dhl_shipment_payload


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


def test_create_shipment_returns_condition_data_as_error():
    provider = DHLBookingProvider()
    result = provider._parse_create_payload(
        '<?xml version="1.0" encoding="UTF-8"?>'
        "<ConditionData>Duty Account Number is not acceptable for Duty Payment Type is R</ConditionData>"
    )

    assert result["error"] == "Duty Account Number is not acceptable for Duty Payment Type is R"


def test_shipment_payload_omits_duty_account_for_receiver_payment(monkeypatch):
    monkeypatch.setattr("app.services.shipment_service.settings.DHL_DUTY_ACCOUNT_NUMBER", "DUTY123")
    monkeypatch.setattr("app.services.shipment_service.settings.DHL_SHIPPER_ACCOUNT_NUMBER", "SHIPPER123")
    monkeypatch.setattr(
        "app.services.shipment_service._dhl_shipper_defaults",
        lambda: {
            "company": "Insta Exhibition",
            "name": "Insta Exhibition",
            "address1": "Andheri",
            "address2": "",
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
                "description": "Exhibition Sample",
                "duty_payment_type": "R",
            },
        }
    )

    assert payload["DutyPaymentType"] == "R"
    assert payload["DutyAccNumber"] == ""
