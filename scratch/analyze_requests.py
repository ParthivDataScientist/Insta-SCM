import json
import re

def analyze_requests():
    with open('reneedapiaccess_/Insta Exhibitions   Json.json', encoding='utf-8') as f:
        d = json.load(f)
    
    # We want to print all requests and their respective details
    requests_info = []
    
    def find_requests(obj, path=""):
        if isinstance(obj, dict):
            if obj.get('type') == 'http':
                name = obj.get('name')
                req = obj.get('request', {})
                url = req.get('url')
                method = req.get('method')
                auth = req.get('auth', {})
                basic = auth.get('basic', {})
                
                # Try to extract credentials from xml body
                xml_body = req.get('body', {}).get('xml', '')
                site_id_match = re.search(r'<tem:SiteId>(.*?)</tem:SiteId>', xml_body)
                password_match = re.search(r'<tem:Password>(.*?)</tem:Password>', xml_body)
                shipper_acc_match = re.search(r'<tem:ShipperAccNumber>(.*?)</tem:ShipperAccNumber>', xml_body)
                shipment_purpose_match = re.search(r'<tem:Shipmentpurpose>(.*?)</tem:Shipmentpurpose>', xml_body)
                
                site_id = site_id_match.group(1) if site_id_match else None
                password = password_match.group(1) if password_match else None
                shipper_acc = shipper_acc_match.group(1) if shipper_acc_match else None
                purpose = shipment_purpose_match.group(1) if shipment_purpose_match else None
                
                requests_info.append({
                    'name': name,
                    'url': url,
                    'method': method,
                    'basic_auth': basic,
                    'site_id': site_id,
                    'password': password,
                    'shipper_acc': shipper_acc,
                    'purpose': purpose
                })
            for k, v in obj.items():
                find_requests(v, path + "/" + str(k))
        elif isinstance(obj, list):
            for item in obj:
                find_requests(item, path)

    find_requests(d)
    
    for r in requests_info:
        print(f"Request: {r['name']}")
        print(f"  URL: {r['url']}")
        print(f"  Basic Auth: {r['basic_auth']}")
        if r['site_id'] or r['password'] or r['shipper_acc'] or r['purpose']:
            print(f"  XML Info: SiteId={r['site_id']}, Password={r['password']}, ShipperAcc={r['shipper_acc']}, Purpose={r['purpose']}")
        print("-" * 50)

if __name__ == '__main__':
    analyze_requests()
