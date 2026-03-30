import sys
import os
sys.path.insert(0, os.path.abspath('.'))

from app.db.session import engine
from sqlmodel import Session, select
from app.models.dashboard_project import DashboardProject
from app.api.v1.endpoints.dashboard_projects import _serialize_project
import json

with Session(engine) as session:
    projects = session.exec(select(DashboardProject)).all()
    print(f'Found {len(projects)} projects')
    for p in projects:
        try:
            res = _serialize_project(p).model_dump()
            print(f'Success serializing project {p.id}')
        except Exception as e:
            print(f'Error serializing project {p.id}: {repr(e)}')
            import traceback
            traceback.print_exc()
            break
