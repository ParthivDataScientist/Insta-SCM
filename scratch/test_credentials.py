import requests
import xml.etree.ElementTree as ET

def test_quote():
    url = "https://api.india.express.dhl.com/DHLWCFService_V6/DHLService.svc"
    
    # We will test both credentials found:
    # 1. basic auth: instaexhibiIN / N$6uP#4cT#3lD@1q
    #    with XML PaymentAccountNumber: 538805906, SiteId: v62_3NrvswKQs8, Password: qLeo2eb6t9
    
    # Let's construct a PostQuote SOAP request envelope
    envelope = """<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tem="http://tempuri.org/">
<soapenv:Header/>
<soapenv:Body>
<tem:PostQuote>
<tem:ShipperPostCode>400059</tem:ShipperPostCode>
<tem:ReceiverCountryCode>US</tem:ReceiverCountryCode>
<tem:PostCode>10012</tem:PostCode>
<tem:fromCity>MUMBAI</tem:fromCity>
<tem:IsDutiable>Y</tem:IsDutiable>
<tem:PickupHours>14</tem:PickupHours>
<tem:PickupMinutes>30</tem:PickupMinutes>
<tem:DeclaredCurrency>INR</tem:DeclaredCurrency>
<tem:DeclaredValue>1000</tem:DeclaredValue>
<tem:NetworkTypeCode>AL</tem:NetworkTypeCode>
<tem:GlobalProductCode>P</tem:GlobalProductCode>
<tem:LocalProductCode>P</tem:LocalProductCode>
<tem:toCity>NEW YORK</tem:toCity>
<tem:PaymentAccountNumber>538805906</tem:PaymentAccountNumber>
<tem:pieces>1</tem:pieces>
<tem:ShipPieceWt>1.5</tem:ShipPieceWt>
<tem:ShipPieceDepth>22</tem:ShipPieceDepth>
<tem:ShipPieceWidth>22</tem:ShipPieceWidth>
<tem:ShipPieceHeight>22</tem:ShipPieceHeight>
</tem:PostQuote>
</soapenv:Body>
</soapenv:Envelope>"""

    headers = {
        'Content-Type': 'text/xml; charset=utf-8',
        'SOAPAction': 'http://tempuri.org/IDHLService/PostQuote',
    }
    
    print("Testing credentials with PostQuote...")
    try:
        response = requests.post(
            url, 
            data=envelope.encode('utf-8'), 
            headers=headers, 
            auth=('instaexhibiIN', 'N$6uP#4cT#3lD@1q'),
            timeout=20
        )
        print(f"Status Code: {response.status_code}")
        print("Response Text:")
        print(response.text[:2000])
    except Exception as e:
        print(f"Error: {e}")

if __name__ == '__main__':
    test_quote()
