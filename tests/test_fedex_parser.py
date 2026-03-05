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

    # -------------------------------------------------------------------------
    # Single-piece sanity checks
    # -------------------------------------------------------------------------

    def test_single_piece_has_empty_child_parcels(self, fedex_service, fedex_response):
        """A normal single-piece shipment must have no child parcels."""
        result = fedex_service._standardize_response(fedex_response)
        assert result["child_parcels"] == []
        assert result["is_master"] is False

    def test_single_piece_child_tracking_numbers_empty(self, fedex_service, fedex_response):
        """Backward-compat list must also be empty for single-piece."""
        result = fedex_service._standardize_response(fedex_response)
        assert result["child_tracking_numbers"] == []


# ---------------------------------------------------------------------------
# MPS (Multi-Piece Shipment) tests
# ---------------------------------------------------------------------------

MPS_FIXTURE_PATH = os.path.join(os.path.dirname(__file__), "fixtures", "fedex_mps_response.json")


@pytest.fixture
def fedex_mps_response():
    with open(MPS_FIXTURE_PATH) as f:
        return json.load(f)


class TestFedExMPSParser:
    def test_mps_is_master_flag_set(self, fedex_service, fedex_mps_response):
        """is_master must be True when the response contains CHILD type associated shipments."""
        result = fedex_service._standardize_response(fedex_mps_response)
        assert result["is_master"] is True

    def test_mps_child_parcels_count(self, fedex_service, fedex_mps_response):
        """All 3 child parcels from the fixture must be extracted."""
        result = fedex_service._standardize_response(fedex_mps_response)
        assert len(result["child_parcels"]) == 3

    def test_mps_child_parcel_has_required_keys(self, fedex_service, fedex_mps_response):
        """Each child parcel dict must contain tracking_number, status, raw_status."""
        result = fedex_service._standardize_response(fedex_mps_response)
        for parcel in result["child_parcels"]:
            assert "tracking_number" in parcel
            assert "status" in parcel
            assert "raw_status" in parcel

    def test_mps_child_statuses_mapped_correctly(self, fedex_service, fedex_mps_response):
        """Each child parcel's status must be mapped from raw FedEx strings."""
        result = fedex_service._standardize_response(fedex_mps_response)
        parcels_by_tn = {p["tracking_number"]: p for p in result["child_parcels"]}

        # 888000000001 → "On FedEx vehicle for delivery" → Out for Delivery
        assert parcels_by_tn["888000000001"]["status"] == "Out for Delivery"
        # 888000000002 → "Delay — clearance in progress" → Exception
        assert parcels_by_tn["888000000002"]["status"] == "Exception"
        # 888000000003 → "Delivered" → Delivered
        assert parcels_by_tn["888000000003"]["status"] == "Delivered"

    def test_mps_backward_compat_list(self, fedex_service, fedex_mps_response):
        """child_tracking_numbers must be a flat list of the child tracking numbers."""
        result = fedex_service._standardize_response(fedex_mps_response)
        expected = {"888000000001", "888000000002", "888000000003"}
        assert set(result["child_tracking_numbers"]) == expected
