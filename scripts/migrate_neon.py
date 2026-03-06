import os
import psycopg2
from dotenv import load_dotenv

# Load environment variables from .env if present
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env"))

def run_migrations():
    db_url = os.environ.get("DATABASE_URL")
    if not db_url:
        print("DATABASE_URL environment variable is not set. Please set it to your Neon database URL.")
        print("Example: set DATABASE_URL=postgres://user:pass@ep-rest-of-url.neon.tech/dbname")
        return

    # the psycopg2 library requires postgres:// to be postgresql:// for sqlalchemy usually,
    # but psycopg2 can handle either.
    print(f"Connecting to database...")

    try:
        conn = psycopg2.connect(db_url)
        conn.autocommit = True
        cur = conn.cursor()

        # Check existing columns in the 'shipment' table
        cur.execute("SELECT column_name FROM information_schema.columns WHERE table_name='shipment';")
        existing_columns = [row[0] for row in cur.fetchall()]

        migrations = [
            ("exhibition_name", "ALTER TABLE shipment ADD COLUMN exhibition_name VARCHAR;"),
            ("master_tracking_number", "ALTER TABLE shipment ADD COLUMN master_tracking_number VARCHAR;"),
            ("is_master", "ALTER TABLE shipment ADD COLUMN is_master BOOLEAN DEFAULT FALSE;"),
            ("child_tracking_numbers", "ALTER TABLE shipment ADD COLUMN child_tracking_numbers JSON;"),
            ("child_parcels", "ALTER TABLE shipment ADD COLUMN child_parcels JSON;"),
        ]

        print("Running migrations...")
        for col_name, stmt in migrations:
            if col_name not in existing_columns:
                try:
                    cur.execute(stmt)
                    print(f"✅ Added column: {col_name}")
                except Exception as e:
                    print(f"❌ Failed to add column {col_name}: {e}")
            else:
                print(f"⏭️  Column {col_name} already exists. Skipping.")

        print("\nAll database migrations complete!")

    except psycopg2.Error as e:
        print(f"Database connection error: {e}")
    finally:
        if 'cur' in locals():
            cur.close()
        if 'conn' in locals() and conn:
            conn.close()

if __name__ == "__main__":
    run_migrations()
