import sys
import os
import io
import asyncio
import pandas as pd
from datetime import datetime

# Add parent dir to path
sys.path.append(".")

# Set up dummy environment so we can import things
os.environ["API_KEY"] = "test"
os.environ["DATABASE_URL"] = "sqlite:///./sql_app.db"

# Now we can import our endpoint/helpers
from app.api.v1.endpoints.shipments import export_shipments
from app.models.shipment import Shipment
from sqlmodel import Session, create_engine, select

async def verify():
    engine = create_engine("sqlite:///sql_app.db")
    session = Session(engine)
    
    # 1. Let's make sure we have at least some mock records or fetch what we have
    stmt = select(Shipment)
    results = session.exec(stmt).all()
    print(f"Database has {len(results)} shipments.")
    
    # If the database has only 1 row, let's add a mock delivered shipment and a child row for testing
    has_delivered = any(s.status == "Delivered" for s in results)
    if not has_delivered:
        print("Adding a mock Delivered shipment and child row for verification...")
        try:
            m_shipment = Shipment(
                tracking_number="TESTDELIVERED123",
                carrier="DHL",
                status="Delivered",
                destination="NEW YORK, US",
                recipient="John Doe",
                booking_date="2026-05-20",
                history=[{
                    "date": "2026-05-22T14:30:00",
                    "status": "Delivered",
                    "location": "NEW YORK, US",
                    "description": "Delivered"
                }],
                is_master=True
            )
            c_shipment = Shipment(
                tracking_number="TESTDELIVEREDCHILD",
                carrier="DHL",
                status="Delivered",
                destination="NEW YORK, US",
                recipient="John Doe",
                master_tracking_number="TESTDELIVERED123",
                last_scan_date="2026-05-22T14:30:00",
                is_master=False
            )
            session.add(m_shipment)
            session.add(c_shipment)
            session.commit()
            print("Successfully added mock shipments.")
        except Exception as e:
            session.rollback()
            print("Failed to add mock shipments:", e)
    
    # 2. Call our export endpoint directly
    try:
        print("Running export_shipments...")
        response = export_shipments(shipment_ids=None, db=session, _key="test")
        
        # Read the StreamingResponse body asynchronously
        body = b""
        async for chunk in response.body_iterator:
            body += chunk
        
        # Load the bytes in pandas
        excel_file = io.BytesIO(body)
        
        # Read Excel sheets
        xl = pd.ExcelFile(excel_file)
        print("Sheet names in generated Excel:", xl.sheet_names)
        
        # Read In Transit sheet
        df_transit = xl.parse("In Transit")
        print("\n=== In Transit Sheet ===")
        print(df_transit.head())
        
        # Read Delivered sheet
        df_delivered = xl.parse("Delivered")
        print("\n=== Delivered Sheet ===")
        print(df_delivered.head())
        
        # Cleanup mock records
        session.rollback()
        stmt_del = select(Shipment).where(Shipment.tracking_number.in_(["TESTDELIVERED123", "TESTDELIVEREDCHILD"]))
        for s in session.exec(stmt_del).all():
            session.delete(s)
        session.commit()
        print("\nDatabase cleaned up.")
        
        # Verification assert
        assert "In Transit" in xl.sheet_names, "In Transit sheet missing"
        assert "Delivered" in xl.sheet_names, "Delivered sheet missing"
        print("\nVerification SUCCESSFUL!")
    except Exception as e:
        print("Verification FAILED:", e)
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(verify())
