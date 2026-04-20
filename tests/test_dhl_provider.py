import html

from app.services.dhl_provider import DHLProvider
from app.services.dhl_validation import DHL_AWB_FORMAT_ERROR


class _MockResponse:
    def __init__(self, status_code: int, text: str):
        self.status_code = status_code
        self.text = text


def _wrap_in_soap(payload: str, result_node: str = "PostTrackingResult") -> str:
    escaped = html.escape(payload)
    return (
        '<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/">'
        "<s:Body>"
        '<PostTrackingResponse xmlns="http://tempuri.org/">'
        f"<{result_node}>{escaped}</{result_node}>"
        "</PostTrackingResponse>"
        "</s:Body>"
        "</s:Envelope>"
    )


def test_dhl_provider_rejects_invalid_awb():
    provider = DHLProvider()
    result = provider.track("1Z12345E0291980793")
    assert result["error"] == DHL_AWB_FORMAT_ERROR


def test_dhl_provider_uses_awbnumber_tag():
    provider = DHLProvider()
    envelope = provider._build_post_tracking_envelope("1234567890")
    assert "<tem:awbnumber>1234567890</tem:awbnumber>" in envelope
    assert "AWBNo" not in envelope


def test_dhl_provider_maps_tracking_payload(monkeypatch):
    provider = DHLProvider()

    payload = (
        '<?xml version="1.0" encoding="utf-8"?>'
        "<TrackingResponse>"
        "<ActionStatus>Success</ActionStatus>"
        "<EstimatedDeliveryDate>2026-04-22</EstimatedDeliveryDate>"
        "<Events>"
        "<Event>"
        "<EventDate>2026-04-19</EventDate>"
        "<EventTime>09:15:00</EventTime>"
        "<EventDescription>Shipment picked up</EventDescription>"
        "<EventLocation>Delhi Service Area</EventLocation>"
        "</Event>"
        "<Event>"
        "<EventDate>2026-04-20</EventDate>"
        "<EventTime>10:30:00</EventTime>"
        "<EventDescription>Arrived at delivery facility</EventDescription>"
        "<EventLocation>Mumbai Hub</EventLocation>"
        "</Event>"
        "</Events>"
        "</TrackingResponse>"
    )

    soap = _wrap_in_soap(payload)
    monkeypatch.setattr(
        "app.services.dhl_provider.requests.post",
        lambda *args, **kwargs: _MockResponse(status_code=200, text=soap),
    )

    result = provider.track("1234567890")

    assert result["current_status"] == "Arrived at delivery facility"
    assert result["estimated_delivery"] == "2026-04-22"
    assert result["last_location"] == "Mumbai Hub"
    assert result["carrier"] == "DHL"


def test_dhl_provider_returns_not_found(monkeypatch):
    provider = DHLProvider()
    payload = '<?xml version="1.0" encoding="utf-8"?><ActionStatus>No Shipments Found</ActionStatus>'
    soap = _wrap_in_soap(payload)
    monkeypatch.setattr(
        "app.services.dhl_provider.requests.post",
        lambda *args, **kwargs: _MockResponse(status_code=200, text=soap),
    )

    result = provider.track("1234567890")
    assert result["error"] == "Shipment not found"


def test_dhl_provider_prefers_all_checkpoint_history(monkeypatch):
    provider = DHLProvider()
    all_checkpoint_payload = (
        '<?xml version="1.0" encoding="utf-8"?>'
        "<AWBInfo>"
        "<ShipmentEvent>"
        "<Date>2026-04-13</Date><Time>23:35:07</Time><EventCode>PU</EventCode>"
        "<Description>Shipment picked up</Description>"
        "<ServiceAreaDescription>MUMBAI (BOMBAY)-IND</ServiceAreaDescription>"
        "</ShipmentEvent>"
        "<ShipmentEvent>"
        "<Date>2026-04-20</Date><Time>06:42:00</Time><EventCode>WC</EventCode>"
        "<Description>Out for delivery</Description>"
        "<ServiceAreaDescription>IRVING, TX, US</ServiceAreaDescription>"
        "</ShipmentEvent>"
        "</AWBInfo>"
    )
    summary_payload = (
        '<?xml version="1.0" encoding="utf-8"?>'
        "<AWBInfo><EventCode>WC</EventCode><Description>Out for delivery</Description></AWBInfo>"
    )

    responses = [
        _MockResponse(status_code=200, text=_wrap_in_soap(all_checkpoint_payload, "PostTracking_AllCheckpointResult")),
        _MockResponse(status_code=200, text=_wrap_in_soap(summary_payload, "PostTrackingResult")),
    ]

    def fake_post(*args, **kwargs):
        return responses.pop(0)

    monkeypatch.setattr("app.services.dhl_provider.requests.post", fake_post)

    result = provider.track("1234567890")

    assert result["current_status"] == "Out for delivery"
    assert result["last_location"] == "IRVING, TX, US"
    assert result["origin"] == "MUMBAI (BOMBAY)-IND"
    assert len(result["history"]) == 2
