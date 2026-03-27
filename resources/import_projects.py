import pandas as pd
from sqlmodel import Session, SQLModel
from app.db.session import engine
from app.models.dashboard_project import DashboardProject
import os
import math

# Re-create tables just in case
SQLModel.metadata.create_all(engine)

file_path = r'd:\Desktop\Insta-Track\Project Pilot sheet.xlsx'
df = pd.read_excel(file_path)

# Fill NaNs with empty string or None
df = df.where(pd.notnull(df), None)

def safe_str(val):
    if val is None or (isinstance(val, float) and math.isnan(val)):
        return None
    # For datetimes, convert to YYYY-MM-DD
    if isinstance(val, pd.Timestamp):
        return val.strftime('%Y-%m-%d')
    s = str(val).strip()
    return s if s else None

# Process and insert rows
added_count = 0
with Session(engine) as session:
    for idx, row in df.iterrows():
        project = DashboardProject(
            project_name=safe_str(row.get('Project Name', 'Unknown')),
            event_name=safe_str(row.get('Event Name')),
            venue=safe_str(row.get('Venue')),
            area=safe_str(row.get('Area (Sqm)')),
            event_start_date=safe_str(row.get('Event Start Date')),
            material_dispatch_date=safe_str(row.get('Material Dispatch Date')),
            installation_start_date=safe_str(row.get('Installation Start Date')),
            installation_end_date=safe_str(row.get('Installation End Date')),
            dismantling_date=safe_str(row.get('Dismantling Date')),
            project_manager=safe_str(row.get('Project Manager')),
            team_type=safe_str(row.get('Team Type')),
            stage=safe_str(row.get('Stage')) or 'Open',
            branch=safe_str(row.get('Branch'))
        )
        session.add(project)
        added_count += 1
    
    session.commit()
    print(f"Successfully imported {added_count} projects into the database.")
