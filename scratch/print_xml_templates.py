import json

def print_xml_templates():
    with open('reneedapiaccess_/Insta Exhibitions   Json.json', encoding='utf-8') as f:
        d = json.load(f)
        
    def find_req(obj, name):
        if isinstance(obj, dict):
            if obj.get('type') == 'http' and obj.get('name') == name:
                return obj
            for k, v in obj.items():
                res = find_req(v, name)
                if res: return res
        elif isinstance(obj, list):
            for item in obj:
                res = find_req(item, name)
                if res: return res
        return None

    for name in ['PostShipment_CSBIV_Cargo', 'PostShipment_CSBV', 'PostShipment_V6', 'PostQuote', 'PostTracking']:
        req = find_req(d, name)
        if req:
            print(f"=== Request: {name} ===")
            print(f"URL: {req.get('request', {}).get('url')}")
            print(f"Basic Auth: {req.get('request', {}).get('auth', {}).get('basic')}")
            print("XML Body:")
            print(req.get('request', {}).get('body', {}).get('xml', '')[:2000])
            print("=" * 60)

if __name__ == '__main__':
    print_xml_templates()
