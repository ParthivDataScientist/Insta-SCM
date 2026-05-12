import html

from app.services.dhl_booking_provider import DHLBookingProvider


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
