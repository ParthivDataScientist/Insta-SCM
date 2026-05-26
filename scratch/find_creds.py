import json

def find_credentials():
    with open('reneedapiaccess_/Insta Exhibitions   Json.json', encoding='utf-8') as f:
        d = json.load(f)
    
    creds = set()
    def find(obj):
        if isinstance(obj, dict):
            if 'basic' in obj:
                creds.add(f"basic: {obj['basic']}")
            for k, v in obj.items():
                if k.lower() in ('password', 'siteid', 'username'):
                    creds.add(f"{k}: {v}")
                if isinstance(v, str) and '<tem:Password>' in v:
                    p = v.split('<tem:Password>')[1].split('</tem:Password>')[0]
                    creds.add(f"xml_password: {p}")
                if isinstance(v, str) and '<tem:SiteId>' in v:
                    s = v.split('<tem:SiteId>')[1].split('</tem:SiteId>')[0]
                    creds.add(f"xml_siteid: {s}")
                if isinstance(v, str) and '<tem:ShipperAccNumber>' in v:
                    acc = v.split('<tem:ShipperAccNumber>')[1].split('</tem:ShipperAccNumber>')[0]
                    creds.add(f"xml_shipper_acc: {acc}")
                find(v)
        elif isinstance(obj, list):
            for item in obj:
                find(item)
    find(d)
    for c in sorted(creds):
        print(c)

if __name__ == '__main__':
    find_credentials()
