"""Integration tests for shipment API endpoints."""
import pytest


class TestHealthEndpoints:
    def test_root(self, client):
        resp = client.get("/")
        assert resp.status_code == 200
        assert "running" in resp.json()["message"].lower()

    def test_health_check(self, client):
        resp = client.get("/api/health")
        assert resp.status_code == 200
        assert resp.json()["status"] == "ok"


class TestListShipments:
    def test_list_empty(self, client):
        resp = client.get("/api/v1/shipments/")
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_stats_empty(self, client):
        resp = client.get("/api/v1/shipments/stats")
        assert resp.status_code == 200
        data = resp.json()
        assert "total" in data
        assert "delivered" in data
        assert "transit" in data
        assert "exceptions" in data


class TestTrackShipment:
    def test_track_fedex_number(self, client):
        """Track a 12-digit FedEx number (mocked service in conftest)."""
        resp = client.post("/api/v1/shipments/track/888598190302")
        assert resp.status_code == 201
        data = resp.json()
        assert data["status"] == "success"
        assert data["carrier"] == "FedEx"
        assert data["tracking_number"] == "888598190302"

    def test_track_creates_db_record(self, client):
        """After tracking, shipment should appear in list."""
        client.post("/api/v1/shipments/track/999000111222")
        resp = client.get("/api/v1/shipments/")
        tracking_numbers = [s["tracking_number"] for s in resp.json()]
        assert "999000111222" in tracking_numbers

    def test_track_invalid_short_number(self, client):
        """Short tracking number should fail validation."""
        resp = client.post("/api/v1/shipments/track/ABC")
        assert resp.status_code == 422  # Pydantic validation error

    def test_track_invalid_special_chars(self, client):
        """Tracking number with special chars should fail regex validation."""
        resp = client.post("/api/v1/shipments/track/123-456-789")
        assert resp.status_code == 422

    def test_track_unsupported_carrier(self, client):
        """Unknown format should return 400 with a helpful message."""
        resp = client.post("/api/v1/shipments/track/UNKNOWNCARRIER1")
        assert resp.status_code == 400


class TestGetShipment:
    def test_get_existing(self, client):
        client.post("/api/v1/shipments/track/111111111111")
        list_resp = client.get("/api/v1/shipments/")
        shipment = next(s for s in list_resp.json() if s["tracking_number"] == "111111111111")
        resp = client.get(f"/api/v1/shipments/{shipment['id']}")
        assert resp.status_code == 200
        assert resp.json()["tracking_number"] == "111111111111"

    def test_get_not_found(self, client):
        resp = client.get("/api/v1/shipments/99999")
        assert resp.status_code == 404


class TestDeleteShipment:
    def test_delete_existing(self, client):
        client.post("/api/v1/shipments/track/222222222222")
        list_resp = client.get("/api/v1/shipments/")
        shipment = next(s for s in list_resp.json() if s["tracking_number"] == "222222222222")
        resp = client.delete(f"/api/v1/shipments/{shipment['id']}")
        assert resp.status_code == 200

    def test_delete_not_found(self, client):
        resp = client.delete("/api/v1/shipments/99999")
        assert resp.status_code == 404

    def test_deleted_shipment_not_in_list(self, client):
        client.post("/api/v1/shipments/track/333333333333")
        list_resp = client.get("/api/v1/shipments/")
        shipment = next(s for s in list_resp.json() if s["tracking_number"] == "333333333333")
        client.delete(f"/api/v1/shipments/{shipment['id']}")
        list_resp2 = client.get("/api/v1/shipments/")
        tracking_numbers = [s["tracking_number"] for s in list_resp2.json()]
        assert "333333333333" not in tracking_numbers
