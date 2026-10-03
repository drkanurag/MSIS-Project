from __future__ import annotations

import csv
from datetime import datetime, timedelta
from pathlib import Path

from db import get_db, _reset_database, import_csv_data

HOME = Path.home()
DOWNLOADS = HOME / "Downloads"

PROVIDER_TYPES = [
    "Grocery Store",
    "Supermarket",
    "Restaurant",
    "Catering Service",
    "Bakery",
    "Farm Market",
]

RECEIVER_TYPES = ["NGO", "Shelter", "Individual", "Community Kitchen"]

FOOD_ITEMS = {
    "Prepared Meals": ["Chickpea Rice Bowl", "Tomato Basil Pasta", "Vegetable Curry", "Chicken Biryani", "Grilled Vegetable Sandwich", "Tomato Lentil Soup", "Paneer Vegetable Wrap"],
    "Fresh Produce": ["Apples and Bananas", "Cabbage and Carrots", "Cucumber Tomato Salad", "Mango Banana Fruit Mix", "Fresh Spinach"],
    "Bakery": ["Whole Wheat Bread", "Blueberry Muffins", "Apple Cinnamon Pastry", "Sesame Bagels", "Chocolate Chip Cookies"],
    "Dairy": ["Toned Milk", "Plain Yogurt", "Paneer Cubes", "Cheddar Cheese", "Plain Curd"],
    "Staples": ["Basmati Rice", "Whole Wheat Flour", "Red Lentils", "Cornflakes", "Brown Rice Grains"],
    "Other": ["Tea and Biscuits", "Roasted Chickpea Snacks", "Fresh Orange Juice", "Gulab Jamun"],
}

CITIES = [
    "Manipal",
    "Bengaluru",
    "Mysuru",
    "Hubballi",
    "Mangaluru",
    "Belagavi",
    "Davangere",
    "Tumakuru",
    "Udupi",
    "Shimoga",
    "Hassan",
    "Chikkamagaluru",
]

PROVIDER_NAMES = [
    "Gonzales-Cochran",
    "Nielsen, Johnson and Fuller",
    "Miller-Black",
    "Clark, Prince and Williams",
    "Davis and Sons",
    "Turner Foods",
    "Harper Market",
    "Dixon Grocery",
    "Ross Catering",
    "Patel Fresh",
    "Walker Foods",
    "Baker & Co.",
    "Hill Pantry",
    "River View Dining",
    "Green Harvest",
    "Bluebird Foods",
    "Metro Fresh",
    "Sunrise Kitchens",
    "Northgate Stores",
    "Evergreen Café",
]

RECEIVER_NAMES = [
    "Donald Gomez",
    "Laurie Ramos",
    "Ashley Mckee",
    "Erika Rose",
    "John Romero",
    "Mandy Sutton",
    "Kenneth Baker",
    "Priya Nair",
    "Rahul Shah",
    "Sonia Menon",
    "Aisha Khan",
    "Ravi Kumar",
    "Meera Das",
    "Nitin Rao",
    "Sana Ali",
    "Vikram Singh",
    "Leena Joseph",
    "Arjun Iyer",
    "Farah Malik",
    "Ananya Bose",
]


def date_for_seed(seed: int, offset: int, start_year: int = 2025) -> datetime:
    base = datetime(start_year, 1, 1)
    return base + timedelta(days=(seed * 37 + offset) % 365)


def write_providers(path: Path):
    rows = []
    for idx in range(1, 121):
        name = PROVIDER_NAMES[(idx - 1) % len(PROVIDER_NAMES)]
        provider_type = PROVIDER_TYPES[(idx - 1) % len(PROVIDER_TYPES)]
        city = CITIES[(idx - 1) % len(CITIES)]
        address = f"{idx * 117} Market Street, {city}"
        contact = f"+1-{900 + idx % 100}-{100 + idx % 900}-{idx % 10000:04d}"
        rows.append([idx, name, provider_type, address, city, contact])

    with path.open("w", newline="", encoding="utf-8") as file:
        writer = csv.writer(file)
        writer.writerow(["Provider_ID", "Name", "Type", "Address", "City", "Contact"])
        writer.writerows(rows)


def write_receivers(path: Path):
    rows = []
    for idx in range(1, 201):
        name = RECEIVER_NAMES[(idx - 1) % len(RECEIVER_NAMES)]
        receiver_type = RECEIVER_TYPES[(idx - 1) % len(RECEIVER_TYPES)]
        city = CITIES[(idx + 3) % len(CITIES)]
        contact = f"{700 + idx % 300}-{100 + idx % 900}-{300 + idx % 700}"
        rows.append([idx, name, receiver_type, city, contact])

    with path.open("w", newline="", encoding="utf-8") as file:
        writer = csv.writer(file)
        writer.writerow(["Receiver_ID", "Name", "Type", "City", "Contact"])
        writer.writerows(rows)


def write_listings(path: Path):
    rows = []
    categories = list(FOOD_ITEMS.keys())
    for listing_id in range(1, 1601):
        category = categories[(listing_id * 7) % len(categories)]
        food_name = FOOD_ITEMS[category][(listing_id * 3) % len(FOOD_ITEMS[category])]
        provider_id = (listing_id * 17) % 120 + 1
        provider_type = PROVIDER_TYPES[(provider_id - 1) % len(PROVIDER_TYPES)]
        city = CITIES[(listing_id * 11) % len(CITIES)]
        quantity = round(2 + (listing_id * 3.7) % 38, 1)
        listed = date_for_seed(listing_id, (listing_id % 13) * 7)
        expiry = listed + timedelta(days=2 + (listing_id % 5))
        rows.append([
            listing_id,
            food_name,
            quantity,
            expiry.strftime("%m/%d/%Y"),
            provider_id,
            provider_type,
            city,
            category,
            "Lunch" if listing_id % 3 == 0 else "Dinner" if listing_id % 3 == 1 else "Breakfast",
        ])

    with path.open("w", newline="", encoding="utf-8") as file:
        writer = csv.writer(file)
        writer.writerow(["Food_ID", "Food_Name", "Quantity", "Expiry_Date", "Provider_ID", "Provider_Type", "Location", "Food_Type", "Meal_Type"])
        writer.writerows(rows)


def write_claims(path: Path):
    rows = []
    for claim_id in range(1, 1401):
        listing_id = ((claim_id * 37) % 1600) + 1
        receiver_id = ((claim_id * 13) % 200) + 1
        status_choices = ["Completed", "Pending", "Cancelled", "Completed", "Pending"]
        status = status_choices[(claim_id * 5) % len(status_choices)]
        claim_date = date_for_seed(claim_id, (claim_id % 17) * 3)
        rows.append([claim_id, listing_id, receiver_id, status, claim_date.strftime("%m-%d-%Y %H.%M")])

    with path.open("w", newline="", encoding="utf-8") as file:
        writer = csv.writer(file)
        writer.writerow(["Claim_ID", "Food_ID", "Receiver_ID", "Status", "Timestamp"])
        writer.writerows(rows)


def generate_csvs():
    DOWNLOADS.mkdir(parents=True, exist_ok=True)
    write_providers(DOWNLOADS / "providers_data.csv")
    write_receivers(DOWNLOADS / "receivers_data.csv")
    write_listings(DOWNLOADS / "food_listings_data.csv")
    write_claims(DOWNLOADS / "claims_data.csv")
    print("Generated full-year CSV files in Downloads.")


def rebuild_database():
    connection = get_db()
    _reset_database(connection)
    import_csv_data(connection)
    connection.execute("INSERT OR REPLACE INTO app_meta(key, value) VALUES ('dataset', 'csv-v1')")
    connection.commit()
    connection.close()
    print("Database rebuilt from the full-year dataset.")


def main():
    generate_csvs()
    rebuild_database()


if __name__ == "__main__":
    main()
