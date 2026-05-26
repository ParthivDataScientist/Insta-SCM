import requests

def test_domestic_quote():
    url = "https://api.india.express.dhl.com/DHLWCFService_V6/DHLService.svc"
    
    envelope = """<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tem="http://tempuri.org/">
<soapenv:Header/>
<soapenv:Body>
<tem:PostQuotePos_V6>
<tem:ShipperPostCode>400059</tem:ShipperPostCode>
<tem:ReceiverCountryCode>IN</tem:ReceiverCountryCode>
<tem:PostCode>110001</tem:PostCode>
<tem:fromCity>MUMBAI</tem:fromCity>
<tem:IsDutiable>N</tem:IsDutiable>
<tem:PickupHours>14</tem:PickupHours>
<tem:PickupMinutes>30</tem:PickupMinutes>
<tem:DeclaredCurrency>INR</tem:DeclaredCurrency>
<tem:DeclaredValue>100</tem:DeclaredValue>
<tem:GlobalProductCode>N</tem:GlobalProductCode>
<tem:LocalProductCode>N</tem:LocalProductCode>
<tem:NetworkTypeCode>AL</tem:NetworkTypeCode>
<tem:toCity>DELHI</tem:toCity>
<tem:PaymentAccountNumber>538805906</tem:PaymentAccountNumber>
<tem:pieces>1</tem:pieces>
<tem:ShipPieceWt>1.5</tem:ShipPieceWt>
<tem:ShipPieceDepth>22</tem:ShipPieceDepth>
<tem:ShipPieceWidth>22</tem:ShipPieceWidth>
<tem:ShipPieceHeight>22</tem:ShipPieceHeight>
<tem:SpecialService>DS</tem:SpecialService>
</tem:PostQuotePos_V6>
</soapenv:Body>
</soapenv:Envelope>"""

    headers = {
        'Content-Type': 'text/xml; charset=utf-8',
        'SOAPAction': 'http://tempuri.org/IDHLService/PostQuotePos_V6',
    }
    
    print("Testing credentials with Domestic PostQuotePos_V6...")
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
    test_domestic_quote()
