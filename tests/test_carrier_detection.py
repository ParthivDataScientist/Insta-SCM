"""Unit tests for carrier detection logic."""
import pytest
from app.services.carrier_detection import detect_carrier


class TestFedExDetection:
    def test_fedex_12_digits(self):
        assert detect_carrier("888598190302") == "FedEx"

    def test_fedex_15_digits(self):
        assert detect_carrier("123456789012345") == "FedEx"

    def test_fedex_20_digits(self):
        assert detect_carrier("96001234567890123456") == "FedEx"

    def test_fedex_22_digits(self):
        assert detect_carrier("9612345678901234567890") == "FedEx"

    def test_fedex_lowercase_input(self):
        """Tracking number with mixed case should be uppercased before matching."""
        assert detect_carrier("888598190302") == "FedEx"


class TestUPSDetection:
    def test_ups_1z_prefix(self):
        assert detect_carrier("1Z12345E0291980793") == "UPS"

    def test_ups_wrong_length(self):
        """UPS but wrong length — should be Unknown."""
        assert detect_carrier("1Z12345E029") != "UPS"


class TestDHLDetection:
    def test_dhl_10_digits(self):
        assert detect_carrier("1234567890") == "DHL"

    def test_dhl_ecommerce_format(self):
        assert detect_carrier("GM123456789DE") == "DHL"


class TestUnknownDetection:
    def test_unknown_gibberish(self):
        assert detect_carrier("ABC") == "Unknown"

    def test_unknown_short_number(self):
        assert detect_carrier("12345") == "Unknown"

    def test_unknown_alpha_only(self):
        assert detect_carrier("ABCDEFGHIJKL") == "Unknown"
