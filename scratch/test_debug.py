import sys
import os

# Add project root to sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

print("\n--- TESTING GET /api/v1/shipments/ ---")
try:
    response = client.get("/api/v1/shipments/")
    print("STATUS:", response.status_code)
    print("RESPONSE (first 100 chars):", response.text[:100])
except Exception as e:
    import traceback
    traceback.print_exc()

print("\n--- TESTING GET /api/v1/shipments/stats ---")
try:
    response = client.get("/api/v1/shipments/stats")
    print("STATUS:", response.status_code)
    print("RESPONSE:", response.text)
except Exception as e:
    import traceback
    traceback.print_exc()

print("\n--- TESTING POST /api/v1/shipments/refresh ---")
try:
    response = client.post("/api/v1/shipments/refresh")
    print("STATUS:", response.status_code)
    print("RESPONSE:", response.text)
except Exception as e:
    import traceback
    traceback.print_exc()

