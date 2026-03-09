import sys
import os
import requests
import json
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from app.services.fedex import FedExService

svc = FedExService()

def test_payload(name, body):
    assoc_url = f"{svc.base_url}/track/v1/associatedshipments"
    headers = {
        "Authorization": f"Bearer {svc._get_token()}",
        "Content-Type": "application/json",
    }
    resp = requests.post(assoc_url, headers=headers, json=body, timeout=20)
    print(f"--- {name} ---")
    print("Payload:", json.dumps(body))
    print("Status:", resp.status_code)
    try:
        print("Data:", resp.json())
    except:
        print("Text:", resp.text)
    print("\n")

test_payload("Test 3: Just master tracking number", {
    "masterTrackingNumberInfo": {"trackingNumber": "888960988286"}
})

test_payload("Test 4: associatedType=MPS", {
    "masterTrackingNumberInfo": {"trackingNumber": "888960988286"},
    "associatedType": "MPS"
})

test_payload("Test 5: associatedType=STANDARD_MPS, ind=boolean false", {
    "masterTrackingNumberInfo": {"trackingNumber": "888960988286"},
    "associatedType": "STANDARD_MPS",
    "associatedReturnReferenceIndicator": False
})

test_payload("Test 6: track endpoint instead of associated with includeDetailedScans", {
    "trackingInfo": [
        {"trackingNumberInfo": {"trackingNumber": "888960988286"}}
    ],
    "includeDetailedScans": True
})

# wait, I also need to test `track/v1/associatedshipments` requires maybe different parameters?
