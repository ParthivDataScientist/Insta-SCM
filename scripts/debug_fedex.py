import sys
import os
import json

# Add backend to path (d:/Desktop/Tracking/backend)
current_dir = os.path.dirname(os.path.abspath(__file__))
backend_path = os.path.join(current_dir, 'backend')
sys.path.append(backend_path)

try:
    from app.services.fedex import FedExService
except ImportError:
    # Try adding the parent of backend if running from root
    sys.path.append(os.path.join(current_dir))
    from backend.app.services.fedex import FedExService

def debug_tracking(tracking_number):
    try:
        service = FedExService()
        print(f"Tracking: {tracking_number}")
        # Initialize token manually if needed, or rely on track()
        
        result = service.track(tracking_number)
        
        print("\n--- STANDARDIZED RESULT ---")
        print(json.dumps(result, indent=2, default=str))
        
        print("\n--- KEY FIELDS ---")
        if "error" not in result:
            print(f"Status: {result.get('status')}")
            print(f"Raw Status: {result.get('raw_status')}")
            print(f"Origin: {result.get('origin')}")
            print(f"Destination: {result.get('destination')}")
        else:
             print(f"Error: {result.get('error')}")
        
    except Exception as e:
        print(f"Error executing track: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    debug_tracking("888598190302")
