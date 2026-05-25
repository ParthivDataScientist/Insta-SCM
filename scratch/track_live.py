import asyncio
import json
import sys
from dotenv import load_dotenv
load_dotenv()

# Add parent dir to path
sys.path.append(".")

from app.services.dhl import DHLService
from app.services.dhl_provider import DHLProvider

async def main():
    service = DHLService()
    provider = DHLProvider()
    
    tns = [
        "5085391124",
        "1444892621",
        "8249615264",
        "JD014600012606799798",
        "JD014600012617081833",
        "JD014600012617081830",
        "8249624891",
        "JD014600012623342008"
    ]
    
    for tn in tns:
        print(f"\n==================== TRACKING {tn} ====================")
        try:
            # First, check summary and all-checkpoint raw payload
            norm_awb = tn.strip().upper()
            
            # Let's run all_checkpoint raw XML fetch
            envelope = provider._build_post_tracking_envelope(norm_awb, operation=provider.OP_POST_TRACKING_ALL)
            headers = provider._build_headers(soap_action_override=provider.ACTION_POST_TRACKING_ALL)
            import httpx
            async with httpx.AsyncClient() as client:
                res = await client.post(provider.endpoint, content=envelope.encode("utf-8"), headers=headers, timeout=20)
            
            print("HTTP STATUS:", res.status_code)
            # Find the result XML node
            from xml.etree import ElementTree as ET
            try:
                root = ET.fromstring(res.text)
                res_node = root.find(".//{*}PostTracking_AllCheckpointResult")
                if res_node is not None and res_node.text:
                    print("AllCheckpoint payload length:", len(res_node.text))
                    # Print first 500 chars of payload
                    print("Payload preview:", res_node.text[:800])
                else:
                    print("No AllCheckpointResult text found.")
            except Exception as e:
                print("Failed to parse XML:", e)
                
            # Now let's run standard track call
            result = await service.track(tn)
            print("Track Result Status:", result.get("status"))
            print("Track Result keys:", list(result.keys()))
            print("Track Result Child Parcels:", len(result.get("child_parcels", [])))
            for cp in result.get("child_parcels", []):
                print(f"  Child: {cp.get('tracking_number')} - Status: {cp.get('status')} - Last Date: {cp.get('last_date')}")
            if result.get("history"):
                print("Latest History Event:", result["history"][0])
            else:
                print("No history events.")
        except Exception as e:
            print("Error tracking:", e)

if __name__ == "__main__":
    asyncio.run(main())
