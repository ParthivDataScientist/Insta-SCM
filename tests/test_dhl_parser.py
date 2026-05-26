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
        result = dhl_service._standardize_response(dhl_response, "1234567890")
        assert result["status"] == "In Transit"

    def test_progress_matches_shipment_status(self, dhl_service, dhl_response):
        result = dhl_service._standardize_response(dhl_response, "1234567890")
        assert result["progress"] == 40

    def test_origin_extracted(self, dhl_service, dhl_response):
        result = dhl_service._standardize_response(dhl_response, "1234567890")
        assert "London" in result["origin"]

    def test_destination_extracted(self, dhl_service, dhl_response):
        result = dhl_service._standardize_response(dhl_response, "1234567890")
        assert "Dubai" in result["destination"]

    def test_eta_date_only(self, dhl_service, dhl_response):
        result = dhl_service._standardize_response(dhl_response, "1234567890")
        assert result["eta"] == "2026-03-04"

    def test_history_has_events(self, dhl_service, dhl_response):
        result = dhl_service._standardize_response(dhl_response, "1234567890")
        assert len(result["history"]) == 2

    def test_history_event_fields(self, dhl_service, dhl_response):
        result = dhl_service._standardize_response(dhl_response, "1234567890")
        event = result["history"][0]
        assert "description" in event
        assert "location" in event
        assert "status" in event
        assert "date" in event

    def test_empty_shipments_returns_error(self, dhl_service):
        result = dhl_service._standardize_response({"shipments": []}, "123")
        assert "error" in result

    def test_malformed_response_returns_error(self, dhl_service):
        # We wrap the call in a try-except in the service, but the parser might raise
        result = dhl_service._standardize_response({"unexpected": "structure"}, "123")
        assert "error" in result

MPS_FIXTURE_PATH = os.path.join(os.path.dirname(__file__), "fixtures", "dhl_mps_response.json")

@pytest.fixture
def dhl_mps_response():
    with open(MPS_FIXTURE_PATH) as f:
        return json.load(f)

class TestDHLMPSParser:
    def test_mps_is_master_flag_set(self, dhl_service, dhl_mps_response):
        result = dhl_service._standardize_response(dhl_mps_response, "DHL8880001")
        assert result["is_master"] is True

    def test_mps_child_parcels_count(self, dhl_service, dhl_mps_response):
        result = dhl_service._standardize_response(dhl_mps_response, "DHL8880001")
        # Total shipments = 2. One is queried (DHL881), so 1 child (DHL882).
        assert len(result["child_parcels"]) == 1
        assert result["child_parcels"][0]["tracking_number"] == "DHL8880002"

    def test_mps_child_parcel_data(self, dhl_service, dhl_mps_response):
        result = dhl_service._standardize_response(dhl_mps_response, "DHL8880001")
        child = result["child_parcels"][0]
        assert child["status"] == "Delivered"
        assert child["raw_status"] == "delivered"
        assert "Bonn" in child["origin"]
        assert "New York" in child["destination"]

    def test_mps_backward_compat_list(self, dhl_service, dhl_mps_response):
        result = dhl_service._standardize_response(dhl_mps_response, "DHL8880001")
        assert result["child_tracking_numbers"] == ["DHL8880002"]

    def test_piece_children_do_not_inherit_master_history_without_piece_scans(self, dhl_service):
        response = {
            "shipments": [
                {
                    "id": "DHL8880001",
                    "status": {"status": "processed"},
                    "origin": {"address": {"addressLocality": "Mumbai", "countryCode": "IN"}},
                    "destination": {"address": {"addressLocality": "Dallas", "countryCode": "US"}},
                    "events": [
                        {
                            "description": "Processed",
                            "timestamp": "2026-05-13T10:00:00",
                            "typeCode": "PL",
                            "location": {"address": {"addressLocality": "Cincinnati Hub", "countryCode": "US"}},
                        }
                    ],
                    "pieces": [
                        {"trackingNumber": "JD014600012603871337"},
                        {"trackingNumber": "JD014600012603871338"},
                    ],
                }
            ]
        }

        result = dhl_service._standardize_response(response, "DHL8880001")

        assert result["is_master"] is True
        assert result["status"] == "In Transit"
        for child in result["child_parcels"]:
            assert child["status"] == "Pending"
            assert child["raw_status"] == "Pending"
            assert child["history"] == []

    def test_piece_children_do_not_synchronize_master_newer_scans(self, dhl_service):
        response = {
            "shipments": [
                {
                    "id": "DHL8880001",
                    "status": {"status": "delivered"},
                    "origin": {"address": {"addressLocality": "Mumbai", "countryCode": "IN"}},
                    "destination": {"address": {"addressLocality": "Dallas", "countryCode": "US"}},
                    "events": [
                        {
                            "description": "Delivered",
                            "timestamp": "2026-05-14T12:00:00",
                            "typeCode": "OK",
                            "location": {"address": {"addressLocality": "Dallas", "countryCode": "US"}},
                        },
                        {
                            "description": "Processed at Cincinnati",
                            "timestamp": "2026-05-13T10:00:00",
                            "typeCode": "PL",
                            "pieceIds": ["JD014600012603871337"],
                            "location": {"address": {"addressLocality": "Cincinnati Hub", "countryCode": "US"}},
                        }
                    ],
                    "pieces": [
                        {"trackingNumber": "JD014600012603871337"},
                        {"trackingNumber": "JD014600012603871338"},
                    ],
                }
            ]
        }

        result = dhl_service._standardize_response(response, "DHL8880001")

        assert result["is_master"] is True
        assert result["status"] == "Delivered"
        assert len(result["child_parcels"]) == 2
        child = result["child_parcels"][0]
        
        # Verify the child is In Transit (from the processed event) and has exactly 1 scan in history (Processed)
        # It should NOT inherit the master's "Delivered" scan at 2026-05-14T12:00:00.
        assert child["status"] == "In Transit"
        assert child["raw_status"] == "Processed at Cincinnati"
        assert len(child["history"]) == 1
        assert child["history"][0]["description"] == "Processed at Cincinnati"

