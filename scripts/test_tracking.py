import requests
import json

BASE_URL = "http://127.0.0.1:8001/api/v1/shipments"

def test_track(tracking_number, expected_carrier):
    print(f"\n--- Testing {tracking_number} (Expected: {expected_carrier}) ---")
    url = f"{BASE_URL}/track/{tracking_number}"
    try:
        response = requests.post(url, json={"recipient": "Test User"})
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"Carrier: {data.get('carrier')}")
            print(f"Status: {data.get('status')}")
            if data.get('carrier') == expected_carrier:
                print("✅ Carrier Match")
            else:
                print(f"❌ Carrier Mismatch (Got {data.get('carrier')})")
        else:
            print(f"Error: {response.text}")
            # If we expect an error (like for UPS), checking the text might be useful
            if expected_carrier == "UPS" and "UPS support not yet implemented" in response.text:
                 print("✅ UPS Not Implemented Error confirmed")
            elif expected_carrier == "DHL" and "DHL" in response.text:
                 print("✅ DHL Attempted (Error is expected without valid creds)")
            else:
                 print("⚠️ Unexpected Error")

    except Exception as e:
        print(f"Request Failed: {e}")

if __name__ == "__main__":
    # Test FedEx (12 digits)
    test_track("123456789012", "FedEx")
    
    # Test DHL (10 digits)
    test_track("1234567890", "DHL")
    
    # Test UPS
    test_track("1Z12345E0205271688", "UPS")
    
    # Test Fallback (Unknown -> FedEx)
    test_track("ABCDEFG", "FedEx") 
