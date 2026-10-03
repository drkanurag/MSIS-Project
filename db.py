from pathlib import Path
import csv
import os
import sqlite3
from datetime import datetime, timedelta

try:
    import psycopg2
    import psycopg2.extras
except ImportError:
    psycopg2 = None

BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "food_redistribution.db"
SCHEMA_PATH = BASE_DIR / "schema.sql"
DOWNLOADS_DIR = Path.home() / "Downloads"


def load_env():
    env_file = BASE_DIR / ".env"
    if env_file.exists():
        for line in env_file.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, val = line.split("=", 1)
                os.environ.setdefault(key.strip(), val.strip())


load_env()

FOOD_DETAILS = {
    "Bagels": ("Sesame Bagels", "Vegetarian"),
    "Biryani": ("Chicken Biryani", "Non-vegetarian"),
    "Bread": ("Whole Wheat Bread", "Vegetarian"),
    "Cookies": ("Chocolate Chip Cookies", "Vegetarian"),
    "Cereal": ("Cornflakes", "Vegetarian"),
    "Cheese": ("Cheddar Cheese", "Vegetarian"),
    "Curry": ("Vegetable Curry", "Vegetarian"),
    "Curd": ("Plain Curd", "Vegetarian"),
    "Desserts": ("Gulab Jamun", "Vegetarian"),
    "Flour": ("Whole Wheat Flour", "Vegetarian"),
    "Fruit Mix": ("Mango Banana Fruit Mix", "Vegetarian"),
    "Fruits": ("Apples and Bananas", "Vegetarian"),
    "Grains": ("Brown Rice Grains", "Vegetarian"),
    "Leafy Greens": ("Fresh Spinach", "Vegetarian"),
    "Milk": ("Toned Milk", "Vegetarian"),
    "Muffins": ("Blueberry Muffins", "Vegetarian"),
    "Paneer": ("Paneer Cubes", "Vegetarian"),
    "Pasta": ("Tomato Basil Pasta", "Vegetarian"),
    "Pastries": ("Apple Cinnamon Pastry", "Vegetarian"),
    "Pulses": ("Red Lentils", "Vegetarian"),
    "Rice": ("Basmati Rice", "Vegetarian"),
    "Rice Bowl": ("Chickpea Rice Bowl", "Vegetarian"),
    "Salad Pack": ("Cucumber Tomato Salad", "Vegetarian"),
    "Sandwich": ("Grilled Vegetable Sandwich", "Vegetarian"),
    "Snacks": ("Roasted Chickpea Snacks", "Vegetarian"),
    "Soup": ("Tomato Lentil Soup", "Vegetarian"),
    "Vegetables": ("Cabbage and Carrots", "Vegetarian"),
    "Wrap": ("Paneer Vegetable Wrap", "Vegetarian"),
    "Yogurt": ("Plain Yogurt", "Vegetarian"),
}


class CursorWrapper:
    def __init__(self, cur):
        self.cur = cur

    def fetchone(self):
        return self.cur.fetchone()

    def fetchall(self):
        return self.cur.fetchall()

    def fetchmany(self, size=None):
        return self.cur.fetchmany(size) if size is not None else self.cur.fetchmany()

    @property
    def rowcount(self):
        return self.cur.rowcount

    @property
    def lastrowid(self):
        return getattr(self.cur, "lastrowid", None)

    def __iter__(self):
        return iter(self.cur)


class PostgresConnectionWrapper:
    def __init__(self, conn):
        self.conn = conn
        self.is_postgres = True

    def execute(self, query, params=None):
        cur = self.conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
        pg_query = query.replace("?", "%s")
        cur.execute(pg_query, params)
        return CursorWrapper(cur)

    def executemany(self, query, seq_of_params):
        cur = self.conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
        pg_query = query.replace("?", "%s")
        cur.executemany(pg_query, seq_of_params)
        return CursorWrapper(cur)

    def commit(self):
        self.conn.commit()

    def rollback(self):
        self.conn.rollback()

    def close(self):
        self.conn.close()

    @property
    def raw(self):
        return self.conn


def get_db():
    db_type = os.environ.get("DB_TYPE", "postgres").lower()
    if db_type == "postgres" and psycopg2:
        try:
            conn = psycopg2.connect(
                host=os.environ.get("PGHOST", "localhost"),
                port=int(os.environ.get("PGPORT", "5432")),
                dbname=os.environ.get("PGDATABASE", "food_redistribution"),
                user=os.environ.get("PGUSER", "postgres"),
                password=os.environ.get("PGPASSWORD", "12345"),
                connect_timeout=3,
            )
            return PostgresConnectionWrapper(conn)
        except Exception as err:
            print(f"[WARN] PostgreSQL connection failed ({err}). Falling back to SQLite.")

    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    return connection


def get_db_type():
    conn = get_db()
    is_pg = getattr(conn, "is_postgres", False)
    conn.close()
    return "PostgreSQL 18" if is_pg else "SQLite"


def _csv(name):
    return DOWNLOADS_DIR / name


def _parse_date(value, formats):
    for date_format in formats:
        try:
            return datetime.strptime(value, date_format)
        except ValueError:
            pass
    raise ValueError(f"Unsupported date format: {value}")


def _reset_database(connection):
    if getattr(connection, "is_postgres", False):
        return
    connection.executescript("DROP TABLE IF EXISTS claims; DROP TABLE IF EXISTS food_listings; DROP TABLE IF EXISTS users; DROP TABLE IF EXISTS providers; DROP TABLE IF EXISTS receivers; DROP TABLE IF EXISTS app_meta;")
    connection.executescript(SCHEMA_PATH.read_text(encoding="utf-8"))


def ensure_tapmi_provider(connection):
    tapmi = connection.execute("SELECT provider_id FROM providers WHERE name = 'TAPMI' OR name LIKE '%TAPMI%'").fetchone()
    if not tapmi:
        max_id = connection.execute("SELECT COALESCE(MAX(provider_id), 0) FROM providers").fetchone()[0]
        tapmi_id = max_id + 1
        connection.execute(
            "INSERT INTO providers(provider_id, name, provider_type, address, location, contact) VALUES (?, ?, ?, ?, ?, ?)",
            (tapmi_id, "TAPMI Campus Dining", "College Cafeteria", "T. A. Pai Management Institute, Badagabettu, Manipal, Karnataka 576104", "Manipal", "+91-820-270-1000")
        )
        existing_user = connection.execute("SELECT user_id FROM users WHERE username = ?", ("tapmi@rooted.local",)).fetchone()
        if not existing_user:
            connection.execute(
                "INSERT INTO users(username, password, role, display_name, provider_id) VALUES (?, ?, 'provider', ?, ?)",
                ("tapmi@rooted.local", "tapmi123", "TAPMI Dining Services", tapmi_id)
            )
        now = datetime.now()
        tapmi_listings = [
            (tapmi_id, "Student Lunch Thali", "Vegetable Rice Bowl", "Vegetarian", "Manipal", "Prepared Meals", "Lunch", 45.0, now, now + timedelta(hours=14), "Available", "Nutritious daily vegetarian lunch thalis from TAPMI student mess."),
            (tapmi_id, "Fresh Seasonal Fruits", "Apples and Bananas", "Vegetarian", "Manipal", "Fresh Produce", "Snacks", 25.0, now, now + timedelta(hours=24), "Available", "Fresh seasonal fruit crates from TAPMI cafeteria."),
            (tapmi_id, "Paneer Butter Masala", "Paneer Curry", "Vegetarian", "Manipal", "Prepared Meals", "Dinner", 30.0, now, now + timedelta(hours=18), "Available", "Warm dinner surplus buffet prepared at TAPMI campus."),
            (tapmi_id, "Whole Wheat Bread & Pastries", "Whole Wheat Bread", "Vegetarian", "Manipal", "Bakery", "Breakfast", 20.0, now, now + timedelta(hours=36), "Available", "Freshly baked breakfast bread loaves from TAPMI pantry."),
            (tapmi_id, "Mixed Veg Biryani", "Vegetable Biryani", "Vegetarian", "Manipal", "Prepared Meals", "Dinner", 35.0, now, now + timedelta(hours=12), "Available", "Aromatic vegetable dum biryani prepared for campus evening dining."),
        ]
        connection.executemany(
            "INSERT INTO food_listings(provider_id, food_name, food_item, dietary_type, location, category, meal_type, quantity_kg, listed_at, expiry_at, status, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            tapmi_listings
        )
        connection.commit()


def init_db():
    connection = get_db()
    if getattr(connection, "is_postgres", False):
        ensure_tapmi_provider(connection)
        connection.close()
        return

    tables = {row["name"] for row in connection.execute("SELECT name FROM sqlite_master WHERE type = 'table'")}
    if "app_meta" not in tables or "users" not in tables:
        _reset_database(connection)
    else:
        columns = {row["name"] for row in connection.execute("PRAGMA table_info(food_listings)")}
        if "location" not in columns:
            connection.execute("ALTER TABLE food_listings ADD COLUMN location VARCHAR(120)")
            connection.execute("UPDATE food_listings SET location = (SELECT location FROM providers WHERE providers.provider_id = food_listings.provider_id)")
        if "food_item" not in columns:
            connection.execute("ALTER TABLE food_listings ADD COLUMN food_item VARCHAR(120)")
            connection.execute("UPDATE food_listings SET food_item = food_name WHERE food_item IS NULL")
        if "dietary_type" not in columns:
            connection.execute("ALTER TABLE food_listings ADD COLUMN dietary_type VARCHAR(20) NOT NULL DEFAULT 'Vegetarian'")
            connection.execute("""UPDATE food_listings SET dietary_type = 'Non-vegetarian'
                WHERE lower(food_item) LIKE '%chicken%' OR lower(food_item) LIKE '%fish%'
                OR lower(food_item) LIKE '%mutton%' OR lower(food_item) LIKE '%beef%'
                OR lower(food_item) LIKE '%pork%' OR lower(food_item) LIKE '%egg%'
                OR lower(food_item) LIKE '%meat%'""")
        connection.executemany("UPDATE food_listings SET food_name = ?, food_item = ?, dietary_type = ? WHERE food_name = ?", [
            (detail, detail, dietary_type, source)
            for source, (detail, dietary_type) in FOOD_DETAILS.items()
        ])
        provider_rows = connection.execute("SELECT provider_id FROM providers ORDER BY provider_id").fetchall()
        for provider in provider_rows:
            provider_id = provider["provider_id"]
            connection.execute(
                "INSERT OR IGNORE INTO users(username, password, role, display_name, provider_id) VALUES (?, 'provider123', 'provider', ?, ?)",
                (f"provider{provider_id}@rooted.local", f"Food Provider {provider_id}", provider_id),
            )
        connection.commit()
    source_files_exist = all(_csv(name).exists() for name in ["providers_data.csv", "receivers_data.csv", "food_listings_data.csv", "claims_data.csv"])
    imported = connection.execute("SELECT value FROM app_meta WHERE key = 'dataset'").fetchone()
    if source_files_exist and (not imported or imported["value"] != "csv-v1"):
        _reset_database(connection)
        import_csv_data(connection)
        connection.execute("INSERT OR REPLACE INTO app_meta(key, value) VALUES ('dataset', 'csv-v1')")
    elif not connection.execute("SELECT COUNT(*) FROM providers").fetchone()[0]:
        seed_db(connection)
    ensure_tapmi_provider(connection)
    connection.commit()
    connection.close()


def import_csv_data(connection):
    providers = []
    with _csv("providers_data.csv").open(newline="", encoding="utf-8-sig") as file:
        for row in csv.DictReader(file):
            providers.append((int(row["Provider_ID"]), row["Name"], row["Type"], row["Address"], row["City"], row["Contact"]))
    connection.executemany("INSERT INTO providers(provider_id, name, provider_type, address, location, contact) VALUES (?, ?, ?, ?, ?, ?)", providers)

    receivers = []
    with _csv("receivers_data.csv").open(newline="", encoding="utf-8-sig") as file:
        for row in csv.DictReader(file):
            receivers.append((int(row["Receiver_ID"]), row["Name"], row["Type"], row["City"], 0, row["Contact"]))
    connection.executemany("INSERT INTO receivers(receiver_id, name, receiver_type, location, capacity_kg, contact) VALUES (?, ?, ?, ?, ?, ?)", receivers)

    listings = []
    with _csv("food_listings_data.csv").open(newline="", encoding="utf-8-sig") as file:
        for row in csv.DictReader(file):
            expiry = _parse_date(row["Expiry_Date"], ["%m/%d/%Y"])
            detail, dietary_type = FOOD_DETAILS.get(row["Food_Name"], (row["Food_Name"], "Non-vegetarian" if "chicken" in row["Food_Name"].lower() else "Vegetarian"))
            listings.append((int(row["Food_ID"]), int(row["Provider_ID"]), detail, detail, dietary_type, row["Location"], row["Food_Type"], row["Meal_Type"], float(row["Quantity"]), expiry - timedelta(days=1), expiry, "Available", f"Provider type: {row['Provider_Type']}; source location: {row['Location']}"))
    connection.executemany("INSERT INTO food_listings(listing_id, provider_id, food_name, food_item, dietary_type, location, category, meal_type, quantity_kg, listed_at, expiry_at, status, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", listings)

    claims = []
    with _csv("claims_data.csv").open(newline="", encoding="utf-8-sig") as file:
        for row in csv.DictReader(file):
            claimed_at = _parse_date(row["Timestamp"], ["%m-%d-%Y %H.%M", "%m-%d-%Y %I.%M", "%m/%d/%Y %H:%M", "%m/%d/%Y %I:%M"])
            quantity = connection.execute("SELECT quantity_kg FROM food_listings WHERE listing_id = ?", (int(row["Food_ID"]),)).fetchone()[0]
            claims.append((int(row["Claim_ID"]), int(row["Food_ID"]), int(row["Receiver_ID"]), quantity, claimed_at, claimed_at, row["Status"]))
            if row["Status"] in ("Completed", "Collected"):
                connection.execute("UPDATE food_listings SET status = 'Completed' WHERE listing_id = ?", (int(row["Food_ID"]),))
            elif row["Status"] == "Pending":
                connection.execute("UPDATE food_listings SET status = 'Claimed' WHERE listing_id = ?", (int(row["Food_ID"]),))
    connection.executemany("INSERT INTO claims(claim_id, listing_id, receiver_id, claimed_kg, claimed_at, pickup_at, status) VALUES (?, ?, ?, ?, ?, ?, ?)", claims)
    connection.executemany(
        "INSERT INTO users(username, password, role, display_name, provider_id) VALUES (?, ?, 'provider', ?, ?)",
        [(f"provider{provider_id}@rooted.local", "provider123", f"Food Provider {provider_id}", provider_id) for provider_id, *_ in providers],
    )
    connection.execute("INSERT INTO users(username, password, role, display_name) VALUES ('admin@rooted.local', 'admin123', 'admin', 'System Administrator')")
    connection.execute("INSERT INTO users(username, password, role, display_name, receiver_id) VALUES ('ngo@rooted.local', 'ngo123', 'ngo', 'Distribution NGO', ?)", (receivers[0][0],))
    ensure_tapmi_provider(connection)


def seed_db(connection):
    now = datetime.now().replace(second=0, microsecond=0)
    connection.execute("INSERT INTO providers VALUES (1, 'Demo Food Provider', 'Restaurant', '', 'Manipal', 'provider@example.com', CURRENT_TIMESTAMP)")
    connection.execute("INSERT INTO receivers VALUES (1, 'Demo NGO', 'NGO', 'Manipal', 100, 'ngo@example.com', CURRENT_TIMESTAMP)")
    connection.execute("INSERT INTO food_listings VALUES (1, 1, 'Demo surplus meal', 'Demo vegetable meal', 'Vegetarian', 'Manipal', 'Prepared Meals', 'Lunch', 25, ?, ?, 'Available', 'Demo record')", (now, now + timedelta(hours=5)))
    connection.execute("INSERT INTO users(username, password, role, display_name, provider_id) VALUES ('provider@rooted.local', 'provider123', 'provider', 'Food Provider', 1)")
    connection.execute("INSERT INTO users(username, password, role, display_name) VALUES ('admin@rooted.local', 'admin123', 'admin', 'System Administrator')")
    connection.execute("INSERT INTO users(username, password, role, display_name, receiver_id) VALUES ('ngo@rooted.local', 'ngo123', 'ngo', 'Distribution NGO', 1)")


if __name__ == "__main__":
    init_db()
    print(f"Database ready ({get_db_type()})")
