-- PostgreSQL Schema for Food Redistribution Platform

CREATE TABLE IF NOT EXISTS providers (
    provider_id SERIAL PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    provider_type VARCHAR(60) NOT NULL,
    address TEXT,
    location VARCHAR(120) NOT NULL,
    contact VARCHAR(160),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS receivers (
    receiver_id SERIAL PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    receiver_type VARCHAR(60) NOT NULL,
    location VARCHAR(120) NOT NULL,
    capacity_kg NUMERIC(10,2) DEFAULT 0,
    contact VARCHAR(160),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS food_listings (
    listing_id SERIAL PRIMARY KEY,
    provider_id INTEGER NOT NULL REFERENCES providers(provider_id),
    food_name VARCHAR(120) NOT NULL,
    food_item VARCHAR(120) NOT NULL,
    dietary_type VARCHAR(20) NOT NULL DEFAULT 'Vegetarian' CHECK (dietary_type IN ('Vegetarian', 'Non-vegetarian')),
    location VARCHAR(120) NOT NULL,
    category VARCHAR(60) NOT NULL,
    meal_type VARCHAR(40),
    quantity_kg NUMERIC(10,2) NOT NULL CHECK (quantity_kg > 0),
    listed_at TIMESTAMP NOT NULL,
    expiry_at TIMESTAMP NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'Available',
    description TEXT
);

CREATE TABLE IF NOT EXISTS claims (
    claim_id SERIAL PRIMARY KEY,
    listing_id INTEGER NOT NULL REFERENCES food_listings(listing_id),
    receiver_id INTEGER NOT NULL REFERENCES receivers(receiver_id),
    claimed_kg NUMERIC(10,2) NOT NULL CHECK (claimed_kg > 0),
    claimed_at TIMESTAMP NOT NULL,
    pickup_at TIMESTAMP,
    status VARCHAR(30) NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Collected', 'Completed', 'Cancelled'))
);

CREATE TABLE IF NOT EXISTS users (
    user_id SERIAL PRIMARY KEY,
    username VARCHAR(120) UNIQUE NOT NULL,
    password VARCHAR(120) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'provider', 'ngo')),
    display_name VARCHAR(120) NOT NULL,
    provider_id INTEGER REFERENCES providers(provider_id),
    receiver_id INTEGER REFERENCES receivers(receiver_id)
);

CREATE TABLE IF NOT EXISTS app_meta (
    key VARCHAR(80) PRIMARY KEY,
    value TEXT NOT NULL
);

