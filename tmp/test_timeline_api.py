import sys
import os

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from sqlmodel import Session
from app.db.session import engine
from app.api.v1.endpoints.dashboard_projects import get_timeline_data

def test():
    with Session(engine) as session:
        data = get_timeline_data(session=session)
        print("Timeline data payload length:", len(data))
        if data:
            print("First item manager:", data[0]['manager'])
            print("First item allocations len:", len(data[0]['allocations']))
            if data[0]['allocations']:
                print("First alloc:", data[0]['allocations'][0])

test()
