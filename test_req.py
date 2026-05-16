import urllib.request
import json

data = {
    'receiver': {
        'name':'Test',
        'phone':'1234567',
        'address_line1':'123',
        'city':'New York',
        'postal_code':'10001',
        'country_code':'US'
    },
    'package': {
        'pieces':1,
        'weight_kg':1,
        'length_cm':10,
        'width_cm':10,
        'height_cm':10,
        'declared_value':10,
        'declared_currency':'USD'
    },
    'shipment': {
        'description':'Test',
        'service_type':'P'
    }
}

req = urllib.request.Request(
    'http://localhost:8001/api/v1/shipments/rate',
    data=json.dumps(data).encode('utf-8'),
    headers={'Content-Type':'application/json', 'Origin':'http://localhost:5173'}
)

try:
    with urllib.request.urlopen(req) as response:
        print("Status:", response.status)
        print("Headers:", response.headers)
        print("Body:", response.read().decode('utf-8'))
except urllib.error.HTTPError as e:
    print("HTTPError Status:", e.code)
    print("Headers:", e.headers)
    print("Body:", e.read().decode('utf-8'))
