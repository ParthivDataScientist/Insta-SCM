import sys
import os
import requests
import json
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from app.services.fedex import FedExService

svc = FedExService()

with open('payload2_realout.txt', 'w') as f:
    assoc_url = f"{svc.base_url}/track/v1/associatedshipments"
    headers = {
        "Authorization": f"Bearer {svc._get_token()}",
        "Content-Type": "application/json",
    }
    body = {
        "masterTrackingNumberInfo": {
            "trackingNumberInfo": {
                "trackingNumber": "888960988286"
            }
        },
        "associatedType": "STANDARD_MPS"
    }
    resp = requests.post(assoc_url, headers=headers, json=body, timeout=20)
    f.write("Status: " + str(resp.status_code) + "\n")
    f.write("Text: " + resp.text + "\n")
