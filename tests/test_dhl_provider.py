import html
import pytest

from app.services.dhl_provider import DHL_CHILD_PIECE_CONTEXT_ERROR, DHL_SOAP_INTERNAL_ERROR, DHLProvider
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


@pytest.mark.anyio
async def test_dhl_provider_rejects_invalid_awb():
    provider = DHLProvider()
    result = await provider.track("1Z12345E0291980793")
    assert result["error"] == DHL_AWB_FORMAT_ERROR


def test_dhl_provider_accepts_child_piece_identifier():
    provider = DHLProvider()
    child_piece = "JD014600012565061255"
    assert provider._validate_input(child_piece, raw_input=child_piece) is None


@pytest.mark.anyio
async def test_dhl_provider_translates_child_piece_null_reference_fault(monkeypatch):
    provider = DHLProvider()
    fault = _wrap_fault("Object reference not set to an instance of an object.")

    async def mock_post(*args, **kwargs):
        return _MockResponse(status_code=500, text=fault)

    monkeypatch.setattr("httpx.AsyncClient.post", mock_post)

    result = await provider.track("JD014600012565061255")

    assert result["error"] == DHL_CHILD_PIECE_CONTEXT_ERROR
    assert "Object reference" not in result["error"]


@pytest.mark.anyio
async def test_dhl_provider_translates_awb_null_reference_fault(monkeypatch):
    provider = DHLProvider()
    fault = _wrap_fault("Object reference not set to an instance of an object.")

    async def mock_post(*args, **kwargs):
        return _MockResponse(status_code=500, text=fault)

    monkeypatch.setattr("httpx.AsyncClient.post", mock_post)

    result = await provider.track("1234567890")

    assert result["error"] == DHL_SOAP_INTERNAL_ERROR
    assert "Object reference" not in result["error"]


def test_dhl_provider_uses_awbnumber_tag():
    provider = DHLProvider()
    envelope = provider._build_post_tracking_envelope("1234567890")
    assert "<tem:awbnumber>1234567890</tem:awbnumber>" in envelope
    assert "AWBNo" not in envelope


@pytest.mark.anyio
async def test_dhl_provider_maps_tracking_payload(monkeypatch):
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
    async def mock_post(*args, **kwargs):
        return _MockResponse(status_code=200, text=soap)

    monkeypatch.setattr("httpx.AsyncClient.post", mock_post)

    result = await provider.track("1234567890")

    assert result["current_status"] == "Arrived at delivery facility"
    assert result["estimated_delivery"] == "2026-04-22"
    assert result["last_location"] == "Mumbai Hub"
    assert result["status"] == "In Transit"
    assert result["carrier"] == "DHL"


@pytest.mark.anyio
async def test_dhl_provider_returns_not_found(monkeypatch):
    provider = DHLProvider()
    payload = '<?xml version="1.0" encoding="utf-8"?><ActionStatus>No Shipments Found</ActionStatus>'
    soap = _wrap_in_soap(payload)
    async def mock_post(*args, **kwargs):
        return _MockResponse(status_code=200, text=soap)

    monkeypatch.setattr("httpx.AsyncClient.post", mock_post)

    result = await provider.track("1234567890")
    assert result["error"] == "Shipment not found"


@pytest.mark.anyio
async def test_dhl_provider_prefers_all_checkpoint_history(monkeypatch):
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

    async def fake_post(*args, **kwargs):
        return responses.pop(0)

    monkeypatch.setattr("httpx.AsyncClient.post", fake_post)

    result = await provider.track("1234567890")

    assert result["current_status"] == "Out for delivery"
    assert result["last_location"] == "IRVING, TX, US"
    assert result["origin"] == "MUMBAI (BOMBAY)-IND"
    assert result["status"] == "Out for Delivery"
    assert len(result["history"]) == 2


@pytest.mark.anyio
async def test_dhl_provider_marks_explicit_delivered_as_delivered(monkeypatch):
    provider = DHLProvider()
    payload = (
        '<?xml version="1.0" encoding="utf-8"?>'
        "<AWBInfo>"
        "<ShipmentEvent>"
        "<Date>2026-04-20</Date><Time>18:30:00</Time><EventCode>OK</EventCode>"
        "<Description>Shipment delivered</Description>"
        "<ServiceAreaDescription>IRVING, TX, US</ServiceAreaDescription>"
        "</ShipmentEvent>"
        "</AWBInfo>"
    )

    soap = _wrap_in_soap(payload, "PostTracking_AllCheckpointResult")
    async def mock_post(*args, **kwargs):
        return _MockResponse(status_code=200, text=soap)

    monkeypatch.setattr("httpx.AsyncClient.post", mock_post)

    # summary call will fail with "missing result node", but detailed succeeds and is enough
    result = await provider.track("1234567890")
    assert result["status"] == "Delivered"


def test_dhl_provider_to_status_bucket_event_codes():
    provider = DHLProvider()

    # Test Exception Codes
    assert provider._to_status_bucket("", "WX") == "Exception"
    assert provider._to_status_bucket("In Transit", "CD") == "Exception"
    assert provider._to_status_bucket("Normal delivery", "OH") == "Exception"

    # Test Delivered Codes
    assert provider._to_status_bucket("Customs Hold", "OK") == "Delivered"

    # Test Out for Delivery Codes
    assert provider._to_status_bucket("In Transit", "WC") == "Out for Delivery"

    # Test In Transit Codes
    assert provider._to_status_bucket("Exception", "AF") == "In Transit"
    assert provider._to_status_bucket("Exception", "DF") == "In Transit"
    assert provider._to_status_bucket("Exception", "PL") == "In Transit"


def test_dhl_provider_to_status_bucket_text_fallback_movement_overrides():
    provider = DHLProvider()

    # Movement overrides should override exception flags
    assert provider._to_status_bucket("processed at facility - delayed in customs") == "In Transit"
    assert provider._to_status_bucket("departed facility - on hold") == "In Transit"
    assert provider._to_status_bucket("forwarded from sorting hub - exception") == "In Transit"


def test_dhl_provider_to_status_bucket_cd_quirk():
    provider = DHLProvider()
    assert provider._to_status_bucket("Clearance event", "CD") == "In Transit"
    assert provider._to_status_bucket("Clearance event with delay", "CD") == "Exception"
    assert provider._to_status_bucket("Clearance Delay", "CD") == "Exception"


def test_dhl_provider_to_status_bucket_text_fallback_strict_boundaries():
    provider = DHLProvider()

    # Match exceptions with strict boundary / prefix checks
    assert provider._to_status_bucket("customs delay") == "Exception"
    assert provider._to_status_bucket("undelivered shipment") == "Exception"
    assert provider._to_status_bucket("on hold at destination") == "Exception"

    # Word boundary prevents partial/false matches
    assert provider._to_status_bucket("the threshold is high") == "In Transit"  # "hold" is in "threshold" but shouldn't match
    assert provider._to_status_bucket("scheduled for delivery") == "In Transit"
    assert provider._to_status_bucket("arrived at delivery facility") == "In Transit"  # "delivery" shouldn't trigger delivered


def test_dhl_provider_to_status_bucket_text_fallback_delivered():
    provider = DHLProvider()

    # Match delivered phrases
    assert provider._to_status_bucket("shipment delivered") == "Delivered"
    assert provider._to_status_bucket("delivered - signed for by John") == "Delivered"

    # Exclusions prevent false positives
    assert provider._to_status_bucket("arrived at delivery facility") == "In Transit"
    assert provider._to_status_bucket("out for delivery") == "Out for Delivery"
    assert provider._to_status_bucket("attempted delivery") == "Exception"
