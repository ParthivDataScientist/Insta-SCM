import requests

envelope = """<?xml version="1.0" encoding="utf-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tem="http://tempuri.org/">
   <soapenv:Header/>
   <soapenv:Body>
      <tem:PostTracking>
         <tem:PieceID>JD014600012607364082</tem:PieceID>
      </tem:PostTracking>
   </soapenv:Body>
</soapenv:Envelope>"""

r = requests.post(
    'https://api.india.express.dhl.com/DHLWCFService_V6/DHLService.svc',
    data=envelope.encode("utf-8"),
    headers={
        'Content-Type': 'text/xml; charset=utf-8',
        'SOAPAction': '"http://tempuri.org/IDHLService/PostTracking"'
    }
)
print(r.status_code)
print(r.text)

envelope2 = """<?xml version="1.0" encoding="utf-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tem="http://tempuri.org/">
   <soapenv:Header/>
   <soapenv:Body>
      <tem:PostTracking>
         <tem:piecenumber>JD014600012607364082</tem:piecenumber>
      </tem:PostTracking>
   </soapenv:Body>
</soapenv:Envelope>"""

r2 = requests.post(
    'https://api.india.express.dhl.com/DHLWCFService_V6/DHLService.svc',
    data=envelope2.encode("utf-8"),
    headers={
        'Content-Type': 'text/xml; charset=utf-8',
        'SOAPAction': '"http://tempuri.org/IDHLService/PostTracking"'
    }
)
print("TEST 2")
print(r2.status_code)
print(r2.text)
