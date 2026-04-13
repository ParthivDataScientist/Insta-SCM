import argparse
import json
import os
import sqlite3
import sys
from contextlib import closing
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

from sqlmodel import SQLModel, Session, select


ROOT_DIR = Path(__file__).resolve().parents[1]
os.chdir(ROOT_DIR)
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from app.api.v1.endpoints.dashboard_projects_v2 import _apply_design_state  # noqa: E402
from app.core.config import settings  # noqa: E402
from app.db.session import engine  # noqa: E402
from app.models.dashboard_project import Client, DashboardProject  # noqa: E402
from app.models.shipment import Shipment  # noqa: E402,F401
from app.models.user import User  # noqa: E402


CLIENT_BLUEPRINTS = [
    ("Reliance Industries", "Conglomerate"),
    ("Wipro", "Technology"),
    ("Havells", "Electrical"),
    ("Agilent Technologies", "Life Sciences"),
    ("Mahindra Electric", "Automotive"),
    ("Asian Paints", "Chemicals"),
    ("Godrej Appliances", "Consumer Durables"),
    ("UltraTech Cement", "Construction"),
    ("Pidilite", "Industrial Materials"),
    ("Tata Consumer", "FMCG"),
]

LOCATION_BLUEPRINTS = [
    {"city": "Mumbai", "branch": "Mumbai", "venue": "Jio World Convention Centre"},
    {"city": "Bengaluru", "branch": "Bangalore", "venue": "Bangalore International Exhibition Centre"},
    {"city": "Delhi", "branch": "Delhi", "venue": "Pragati Maidan"},
    {"city": "Hyderabad", "branch": "Hyderabad", "venue": "HITEX Exhibition Centre"},
    {"city": "Pune", "branch": "Pune", "venue": "Auto Cluster Exhibition Center"},
    {"city": "Chennai", "branch": "Chennai", "venue": "Chennai Trade Centre"},
    {"city": "Ahmedabad", "branch": "Ahmedabad", "venue": "Helipad Exhibition Centre"},
    {"city": "Kolkata", "branch": "Kolkata", "venue": "Biswa Bangla Mela Prangan"},
    {"city": "Jaipur", "branch": "Jaipur", "venue": "Jaipur Exhibition & Convention Centre"},
    {"city": "Dubai", "branch": "Dubai", "venue": "Dubai World Trade Centre"},
    {"city": "Singapore", "branch": "Singapore", "venue": "Marina Bay Sands Expo"},
    {"city": "Indore", "branch": "Indore", "venue": "Brilliant Convention Centre"},
]

EVENT_BLUEPRINTS = [
    ("Smart Manufacturing Expo", "Innovation Pavilion"),
    ("BuildTech India", "Experience Center"),
    ("RetailX Summit", "Product Showcase"),
    ("Renewable World Expo", "Interactive Zone"),
    ("Mobility Next Forum", "Launch Stand"),
    ("Pharma Pack Expo", "Discovery Booth"),
    ("Cloud Infra Forum", "Experience Lounge"),
    ("Future of Work Expo", "Solutions Pavilion"),
    ("Design & Build Week", "Signature Stand"),
    ("FoodTech India", "Demo Hub"),
    ("Industrial Innovation Fair", "Brand Experience"),
    ("Digital Commerce Summit", "Engagement Booth"),
    ("Healthcare Devices Expo", "Live Showcase"),
    ("Smart Living Show", "Feature Pavilion"),
]

STATUS_PLAN = (
    ["pending"] * 16
    + ["in_progress"] * 12
    + ["changes"] * 10
    + ["won"] * 7
    + ["lost"] * 5
)

BASE_USERS = [
    {
        "email": "parthivpatel684@gmail.com",
        "full_name": "Parthiv patel",
        "role": "Admin",
        "is_active": True,
        "hashed_password": "$2b$12$o7rPzRTNWzwp/0nfwRB0peQYgzLEN1/q6z5LWt193h/Yibq2S565q",
    },
    {
        "email": "test@test.com",
        "full_name": "Test User",
        "role": "Operator",
        "is_active": True,
        "hashed_password": "$2b$12$bsjeqvKNS1qUbIFySwfZOuq6wpXPjYP0qXGMxGOzsKWYnLvyy.3sa",
    },
    {
        "email": "parthivpatel6842@gmail.com",
        "full_name": "Parthiv patel",
        "role": "Operator",
        "is_active": True,
        "hashed_password": "$2b$12$oURG0oiE8KlCQgkp8XVgeObSacql5MAmywfx7rOgigXcZAucwmvWW",
    },
    {
        "email": "parthivpatel6841@gmail.com",
        "full_name": "Parthiv patel",
        "role": "Operator",
        "is_active": True,
        "hashed_password": "$2b$12$JQgLuGj471X56wHeT0LvoOtht15JKRd1YkMCe48dRkN/nBCnVOKDW",
    },
    {
        "email": "parthiv@insta-scm.com",
        "full_name": "Parthiv",
        "role": "PROJECT_MANAGER",
        "is_active": True,
        "hashed_password": "DUMMY_PASSWORD_SCM",
    },
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Top up the local design dashboard dataset.")
    parser.add_argument("--target-total", type=int, default=50, help="Desired total row count in dashboardproject.")
    parser.add_argument(
        "--dump-path",
        default=str(ROOT_DIR / "data_dump.json"),
        help="Path for the exported JSON dump.",
    )
    return parser.parse_args()


def resolve_sqlite_db_path() -> Path:
    raw_url = settings.DATABASE_URL
    prefix = "sqlite:///./"
    if raw_url.startswith(prefix):
        return ROOT_DIR / raw_url[len(prefix):]
    if raw_url.startswith("sqlite:///"):
        return Path(raw_url[len("sqlite:///"):])
    return ROOT_DIR / "sql_app.db"


def database_is_readable(db_path: Path) -> bool:
    if not db_path.exists():
        return True

    try:
        with closing(sqlite3.connect(db_path)) as connection:
            connection.execute("SELECT name FROM sqlite_master LIMIT 1").fetchall()
        return True
    except sqlite3.Error:
        return False


def backup_corrupted_database(db_path: Path) -> list[str]:
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
    backed_up: list[str] = []

    for path in (db_path, db_path.with_name(f"{db_path.name}-journal")):
        if not path.exists():
            continue
        backup_path = path.with_name(f"{path.name}.corrupt-{timestamp}.bak")
        path.replace(backup_path)
        backed_up.append(str(backup_path))

    return backed_up


def ensure_base_users(session: Session) -> None:
    for user_payload in BASE_USERS:
        existing = session.exec(select(User).where(User.email == user_payload["email"])).first()
        if existing:
            continue

        session.add(User(**user_payload))
        session.flush()


def ensure_clients(session: Session) -> dict[str, Client]:
    clients: dict[str, Client] = {}
    for name, industry in CLIENT_BLUEPRINTS:
        client = session.exec(select(Client).where(Client.name == name)).first()
        if not client:
            client = Client(name=name, industry=industry)
            session.add(client)
            session.flush()
        clients[name] = client
    return clients


def build_revision_history(version_names: list[str], notes: list[str], offset: int) -> list[dict[str, str]]:
    base_time = datetime(2026, 3, 1, 9, 0, tzinfo=timezone.utc) + timedelta(days=offset)
    history = []
    for index, version in enumerate(version_names):
        history.append(
            {
                "version": version,
                "timestamp": (base_time + timedelta(days=index * 2)).isoformat(),
                "notes": notes[index],
            }
        )
    return history


def build_status_fields(status: str, index: int) -> dict:
    if status == "pending":
        return {
            "status": "pending",
            "current_version": None,
            "revision_count": 0,
            "revision_history": [],
        }

    if status == "in_progress":
        return {
            "status": "in_progress",
            "current_version": "V1",
            "revision_count": 0,
            "revision_history": build_revision_history(
                ["V1"],
                ["Initial concept deck shared with client"],
                index,
            ),
        }

    if status == "changes":
        version_names = ["V1", "V2"] if index % 2 == 0 else ["V1", "V2", "V3"]
        notes = [
            "Initial layout shared",
            "Client requested revisions",
            "Refined variant issued for final review",
        ][: len(version_names)]
        return {
            "status": "changes",
            "current_version": version_names[-1],
            "revision_count": len(version_names) - 1,
            "revision_history": build_revision_history(version_names, notes, index),
        }

    if status == "won":
        version_names = ["V1", "V2", "V3"] if index % 2 == 0 else ["V1", "V2"]
        notes = [
            "Kickoff concept approved internally",
            "Client approved branded revisions",
            "Final artwork package signed off",
        ][: len(version_names)]
        return {
            "status": "won",
            "current_version": version_names[-1],
            "revision_count": len(version_names) - 1,
            "revision_history": build_revision_history(version_names, notes, index),
            "is_active": False,
        }

    version_names = ["V1", "V2"] if index % 2 == 0 else ["V1"]
    notes = [
        "Initial design pack sent",
        "Commercial feedback received before opportunity closed",
    ][: len(version_names)]
    return {
        "status": "lost",
        "current_version": version_names[-1],
        "revision_count": len(version_names) - 1,
        "revision_history": build_revision_history(version_names, notes, index),
        "is_active": False,
    }


def project_payload(index: int, clients: dict[str, Client]) -> dict:
    client_name, _industry = CLIENT_BLUEPRINTS[index % len(CLIENT_BLUEPRINTS)]
    location = LOCATION_BLUEPRINTS[index % len(LOCATION_BLUEPRINTS)]
    event_name, label = EVENT_BLUEPRINTS[index % len(EVENT_BLUEPRINTS)]
    client = clients[client_name]
    status = STATUS_PLAN[index - 1]

    booking_date = date(2026, 4, 10) + timedelta(days=index * 2)
    event_start_date = booking_date + timedelta(days=8 + (index % 9))
    event_end_date = event_start_date + timedelta(days=1 + (index % 3))

    payload = {
        "crm_project_id": f"CRM-DES-{5000 + index}",
        "project_name": f"{client_name.split()[0]} {label} {location['city']}",
        "client_id": client.id,
        "city": location["city"],
        "event_name": event_name,
        "venue": location["venue"],
        "area": f"{54 + (index % 8) * 18} Sqm",
        "branch": location["branch"],
        "booking_date": booking_date,
        "event_start_date": event_start_date,
        "event_end_date": event_end_date,
        "dispatch_date": event_start_date - timedelta(days=3),
        "installation_start_date": event_start_date - timedelta(days=2),
        "installation_end_date": event_start_date - timedelta(days=1),
        "dismantling_date": event_end_date + timedelta(days=1),
        "allocation_start_date": event_start_date - timedelta(days=5),
        "allocation_end_date": event_end_date,
        "board_stage": "TBC",
        "comments": [],
        "materials": [],
        "photos": [],
        "qc_steps": [],
    }
    payload.update(build_status_fields(status, index))
    return payload


def normalize_existing_rows(session: Session, clients: dict[str, Client]) -> None:
    existing_patches = {
        "CRM-DES-2401": {
            "client_id": clients["Wipro"].id,
            "booking_date": date(2026, 4, 1),
            "status": "won",
            "current_version": "V3",
            "revision_count": 2,
            "revision_history": build_revision_history(
                ["V1", "V2", "V3"],
                [
                    "Initial concept shared",
                    "Updated pavilion branding submitted",
                    "Final pavilion approved by client",
                ],
                1,
            ),
            "city": "Bengaluru",
            "branch": "Bangalore",
            "venue": "Yelahanka Air Force Station",
        },
        "CRM-DES-2402": {
            "client_id": clients["Agilent Technologies"].id,
            "booking_date": date(2026, 3, 7),
            "status": "changes",
            "current_version": "V2",
            "revision_count": 1,
            "revision_history": build_revision_history(
                ["V1", "V2"],
                [
                    "Initial booth concept shared",
                    "Client requested revisions to welcome wall and counters",
                ],
                2,
            ),
        },
        "CRM-DES-2403": {
            "client_id": clients["Reliance Industries"].id,
            "booking_date": date(2026, 3, 12),
            "status": "lost",
            "current_version": "V1",
            "revision_count": 0,
            "revision_history": build_revision_history(
                ["V1"],
                ["Opportunity closed before second round"],
                3,
            ),
            "is_active": False,
        },
    }

    for crm_project_id, patch in existing_patches.items():
        project = session.exec(
            select(DashboardProject).where(DashboardProject.crm_project_id == crm_project_id)
        ).first()
        if not project:
            continue
        _apply_design_state(project, patch)
        session.add(project)


def seed_design_rows(session: Session, clients: dict[str, Client], target_total: int) -> tuple[int, int]:
    existing_total = len(session.exec(select(DashboardProject)).all())
    rows_needed = max(0, target_total - existing_total)
    inserted = 0

    for index in range(1, len(STATUS_PLAN) + 1):
        if inserted >= rows_needed:
            break

        payload = project_payload(index, clients)
        existing = session.exec(
            select(DashboardProject).where(DashboardProject.crm_project_id == payload["crm_project_id"])
        ).first()
        if existing:
            continue

        project = DashboardProject(
            crm_project_id=payload["crm_project_id"],
            project_name=payload["project_name"],
            board_stage="TBC",
        )
        _apply_design_state(project, payload)
        session.add(project)
        inserted += 1

    return existing_total, inserted


def export_dump(dump_path: str) -> None:
    connection = sqlite3.connect(resolve_sqlite_db_path())
    try:
        tables = ["user", "client", "dashboardproject", "projectauditlog", "shipment"]
        payload = {}
        for table in tables:
            rows = connection.execute(f'SELECT * FROM "{table}"').fetchall()
            payload[table] = [
                {str(index): value for index, value in enumerate(row)}
                for row in rows
            ]

        with open(dump_path, "w", encoding="utf-8") as dump_file:
            json.dump(payload, dump_file, default=str)
    finally:
        connection.close()


def main() -> None:
    args = parse_args()
    db_path = resolve_sqlite_db_path()
    backup_paths: list[str] = []

    if not database_is_readable(db_path):
        backup_paths = backup_corrupted_database(db_path)
    SQLModel.metadata.create_all(engine)

    with Session(engine) as session:
        ensure_base_users(session)
        clients = ensure_clients(session)
        normalize_existing_rows(session, clients)
        previous_total, inserted = seed_design_rows(session, clients, args.target_total)
        session.commit()
        final_total = len(session.exec(select(DashboardProject)).all())

    export_dump(args.dump_path)

    print(
        json.dumps(
            {
                "previous_total": previous_total,
                "inserted": inserted,
                "final_total": final_total,
                "dump_path": args.dump_path,
                "database_backups": backup_paths,
            }
        )
    )


if __name__ == "__main__":
    main()
