"""Unit tests for FedEx response parser (_standardize_response)."""
import json
import os
import pytest
from unittest.mock import MagicMock

FIXTURE_PATH = os.path.join(os.path.dirname(__file__), "fixtures", "fedex_response.json")


@pytest.fixture
def fedex_response():
    with open(FIXTURE_PATH) as f:
        return json.load(f)


@pytest.fixture
def fedex_service():
    from app.services.fedex import FedExService
    svc = FedExService.__new__(FedExService)
    svc.base_url = "https://apis.fedex.com"
    svc.client_id = ""
    svc.client_secret = ""
    return svc


class TestFedExParser:
    def test_status_mapped_correctly(self, fedex_service, fedex_response):
        result = fedex_service._standardize_response(fedex_response)
        assert result["status"] == "Out for Delivery"

    def test_progress_matches_status(self, fedex_service, fedex_response):
        result = fedex_service._standardize_response(fedex_response)
        assert result["progress"] == 80  # Out for Delivery → 80

    def test_origin_extracted(self, fedex_service, fedex_response):
        result = fedex_service._standardize_response(fedex_response)
        assert "New York" in result["origin"]

    def test_destination_extracted(self, fedex_service, fedex_response):
        result = fedex_service._standardize_response(fedex_response)
        assert "Los Angeles" in result["destination"]

    def test_eta_extracted(self, fedex_service, fedex_response):
        result = fedex_service._standardize_response(fedex_response)
        assert result["eta"] == "2026-03-02"

    def test_history_sorted_newest_first(self, fedex_service, fedex_response):
        result = fedex_service._standardize_response(fedex_response)
        history = result["history"]
        assert len(history) >= 2
        # First event should be the newest date
        assert history[0]["date"] >= history[1]["date"]

    def test_history_event_has_required_fields(self, fedex_service, fedex_response):
        result = fedex_service._standardize_response(fedex_response)
        event = result["history"][0]
        assert "description" in event
        assert "location" in event
        assert "status" in event
        assert "date" in event

    def test_malformed_response_returns_error(self, fedex_service):
        result = fedex_service._standardize_response({"bad": "data"})
        assert "error" in result

    def test_no_raw_data_in_response(self, fedex_service, fedex_response):
        """Ensure raw API payload is not stored in DB (saves space, hides internals)."""
        result = fedex_service._standardize_response(fedex_response)
        assert "raw" not in result
