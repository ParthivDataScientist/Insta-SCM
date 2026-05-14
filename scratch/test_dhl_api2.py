import requests

envelope = """<?xml version="1.0" encoding="utf-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tem="http://tempuri.org/">
   <soapenv:Header/>
   <soapenv:Body>
      <tem:PostTracking>
         <tem:awbnumber>014600012607364082</tem:awbnumber>
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
print("TEST WITHOUT JD")
print(r.status_code)
print(r.text)
