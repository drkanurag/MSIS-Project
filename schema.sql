CREATE TABLE providers (
    provider_id INTEGER PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    provider_type VARCHAR(60) NOT NULL,
    address TEXT,
    location VARCHAR(120) NOT NULL,
    contact VARCHAR(160),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE receivers (
    receiver_id INTEGER PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    receiver_type VARCHAR(60) NOT NULL,
    location VARCHAR(120) NOT NULL,
    capacity_kg DECIMAL(10,2) DEFAULT 0,
    contact VARCHAR(160),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE food_listings (
    listing_id INTEGER PRIMARY KEY,
    provider_id INTEGER NOT NULL,
    food_name VARCHAR(120) NOT NULL,
    food_item VARCHAR(120) NOT NULL,
    dietary_type VARCHAR(20) NOT NULL DEFAULT 'Vegetarian' CHECK (dietary_type IN ('Vegetarian', 'Non-vegetarian')),
    location VARCHAR(120) NOT NULL,
    category VARCHAR(60) NOT NULL,
    meal_type VARCHAR(40),
    quantity_kg DECIMAL(10,2) NOT NULL CHECK (quantity_kg > 0),
    listed_at TIMESTAMP NOT NULL,
    expiry_at TIMESTAMP NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'Available',
    description TEXT,
    FOREIGN KEY (provider_id) REFERENCES providers(provider_id)
);
CREATE TABLE claims (
    claim_id INTEGER PRIMARY KEY,
    listing_id INTEGER NOT NULL,
    receiver_id INTEGER NOT NULL,
    claimed_kg DECIMAL(10,2) NOT NULL CHECK (claimed_kg > 0),
    claimed_at TIMESTAMP NOT NULL,
    pickup_at TIMESTAMP,
    status VARCHAR(30) NOT NULL DEFAULT 'Pending',
    FOREIGN KEY (listing_id) REFERENCES food_listings(listing_id),
    FOREIGN KEY (receiver_id) REFERENCES receivers(receiver_id)
);
CREATE TABLE users (
    user_id INTEGER PRIMARY KEY AUTOINCREMENT,
    username VARCHAR(120) UNIQUE NOT NULL,
    password VARCHAR(120) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'provider', 'ngo')),
    display_name VARCHAR(120) NOT NULL,
    provider_id INTEGER,
    receiver_id INTEGER,
    FOREIGN KEY (provider_id) REFERENCES providers(provider_id),
    FOREIGN KEY (receiver_id) REFERENCES receivers(receiver_id)
);
CREATE TABLE app_meta (key VARCHAR(80) PRIMARY KEY, value TEXT NOT NULL);
