"""
Migration Utility: SQLite (food_redistribution.db) -> PostgreSQL (food_redistribution)
"""
import os
import sqlite3
import psycopg2
import psycopg2.extras
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
SQLITE_DB = BASE_DIR / "food_redistribution.db"

PGHOST = os.environ.get("PGHOST", "localhost")
PGPORT = int(os.environ.get("PGPORT", "5432"))
PGDATABASE = os.environ.get("PGDATABASE", "food_redistribution")
PGUSER = os.environ.get("PGUSER", "postgres")
PGPASSWORD = os.environ.get("PGPASSWORD", "12345")


def load_env():
    env_file = BASE_DIR / ".env"
    if env_file.exists():
        for line in env_file.read_text().splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, val = line.split("=", 1)
                os.environ.setdefault(key.strip(), val.strip())


def migrate():
    load_env()
    print(f"Connecting to PostgreSQL {os.environ.get('PGUSER', 'postgres')}@{os.environ.get('PGHOST', 'localhost')}:{os.environ.get('PGPORT', '5432')}/{os.environ.get('PGDATABASE', 'food_redistribution')}...")
    pg_conn = psycopg2.connect(
        host=os.environ.get("PGHOST", "localhost"),
        port=int(os.environ.get("PGPORT", "5432")),
        dbname=os.environ.get("PGDATABASE", "food_redistribution"),
        user=os.environ.get("PGUSER", "postgres"),
        password=os.environ.get("PGPASSWORD", "12345"),
    )
    pg_cur = pg_conn.cursor()

    # Create printf compatibility function
    pg_cur.execute("""
    CREATE OR REPLACE FUNCTION printf(fmt text, num integer) RETURNS text AS '
    BEGIN
        IF fmt = ''CL-%04d'' THEN
            RETURN ''CL-'' || LPAD(num::text, 4, ''0'');
        ELSE
            RETURN LPAD(num::text, 4, ''0'');
        END IF;
    END;' LANGUAGE plpgsql IMMUTABLE;
    """)

    # Connect to SQLite
    sqlite_conn = sqlite3.connect(SQLITE_DB)
    sqlite_conn.row_factory = sqlite3.Row

    # Table sync order (respecting foreign keys)
    tables = [
        ("providers", ["provider_id", "name", "provider_type", "address", "location", "contact", "created_at"]),
        ("receivers", ["receiver_id", "name", "receiver_type", "location", "capacity_kg", "contact", "created_at"]),
        ("food_listings", ["listing_id", "provider_id", "food_name", "food_item", "dietary_type", "location", "category", "meal_type", "quantity_kg", "listed_at", "expiry_at", "status", "description"]),
        ("claims", ["claim_id", "listing_id", "receiver_id", "claimed_kg", "claimed_at", "pickup_at", "status"]),
        ("users", ["user_id", "username", "password", "role", "display_name", "provider_id", "receiver_id"]),
        ("app_meta", ["key", "value"]),
    ]

    for table_name, cols in tables:
        sqlite_cur = sqlite_conn.cursor()
        rows = sqlite_cur.execute(f"SELECT {', '.join(cols)} FROM {table_name}").fetchall()
        print(f"Migrating {len(rows)} records for {table_name}...")

        # Clear existing table data safely
        pg_cur.execute(f"TRUNCATE TABLE {table_name} CASCADE;")

        if rows:
            cols_str = ", ".join(cols)
            placeholders = ", ".join(["%s"] * len(cols))
            insert_query = f"INSERT INTO {table_name} ({cols_str}) VALUES ({placeholders})"
            row_tuples = [tuple(r[col] for col in cols) for r in rows]
            psycopg2.extras.execute_batch(pg_cur, insert_query, row_tuples, page_size=500)

        # Set sequences
        id_col = cols[0]
        if id_col.endswith("_id"):
            seq_name = f"{table_name}_{id_col}_seq"
            pg_cur.execute(f"SELECT setval('{seq_name}', COALESCE((SELECT MAX({id_col}) FROM {table_name}), 1));")

    pg_conn.commit()
    sqlite_conn.close()
    pg_conn.close()
    print("Migration completed successfully!")


if __name__ == "__main__":
    migrate()

