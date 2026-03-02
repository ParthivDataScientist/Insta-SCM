import sys
import os

print("Diagnostics: Checking backend imports...")
try:
    # Add backend to path
    sys.path.append(os.path.join(os.getcwd(), "backend"))
    
    print("  Importing app.main...")
    from app.main import app
    print("  ✅ Backend Import Successful")
    
    print("  Checking database connection...")
    from app.db.session import engine
    from sqlmodel import Session, select
    from app.models.shipment import Shipment
    
    with Session(engine) as session:
        count = session.exec(select(Shipment)).all()
        print(f"  ✅ Database Connected. Shipment count: {len(count)}")
        
except Exception as e:
    print(f"  ❌ FAILURE: {e}")
    import traceback
    traceback.print_exc()
