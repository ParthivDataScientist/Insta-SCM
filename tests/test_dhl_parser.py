"""Unit tests for DHL response parser (_standardize_response)."""
import json
import os
import pytest

FIXTURE_PATH = os.path.join(os.path.dirname(__file__), "fixtures", "dhl_response.json")


@pytest.fixture
def dhl_response():
    with open(FIXTURE_PATH) as f:
        return json.load(f)


@pytest.fixture
def dhl_service():
    from app.services.dhl import DHLService
    svc = DHLService.__new__(DHLService)
    svc.base_url = "https://api-eu.dhl.com/express/v1"
    svc.api_key = ""
    svc.api_secret = ""
    return svc


class TestDHLParser:
    def test_status_mapped_correctly(self, dhl_service, dhl_response):
        result = dhl_service._standardize_response(dhl_response)
        assert result["status"] == "In Transit"

    def test_progress_matches_shipment_status_not_event_status(self, dhl_service, dhl_response):
        """
        Critical regression test: progress must be based on shipment-level status,
        NOT the last event's type code (the shadowing bug fix).
        """
        result = dhl_service._standardize_response(dhl_response)
        # In fixture: shipment status = "transit" → "In Transit" → progress = 40
        assert result["progress"] == 40

    def test_origin_extracted(self, dhl_service, dhl_response):
        result = dhl_service._standardize_response(dhl_response)
        assert "London" in result["origin"]

    def test_destination_extracted(self, dhl_service, dhl_response):
        result = dhl_service._standardize_response(dhl_response)
        assert "Dubai" in result["destination"]

    def test_eta_date_only(self, dhl_service, dhl_response):
        result = dhl_service._standardize_response(dhl_response)
        # Should strip the time portion: "2026-03-04T23:59:00" → "2026-03-04"
        assert result["eta"] == "2026-03-04"

    def test_history_has_events(self, dhl_service, dhl_response):
        result = dhl_service._standardize_response(dhl_response)
        assert len(result["history"]) == 2

    def test_history_event_fields(self, dhl_service, dhl_response):
        result = dhl_service._standardize_response(dhl_response)
        event = result["history"][0]
        assert "description" in event
        assert "location" in event
        assert "status" in event
        assert "date" in event

    def test_empty_shipments_returns_error(self, dhl_service):
        result = dhl_service._standardize_response({"shipments": []})
        assert "error" in result

    def test_malformed_response_returns_error(self, dhl_service):
        result = dhl_service._standardize_response({"unexpected": "structure"})
        assert "error" in result

    def test_no_raw_data_in_response(self, dhl_service, dhl_response):
        result = dhl_service._standardize_response(dhl_response)
        assert "raw" not in result
