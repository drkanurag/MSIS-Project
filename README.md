# Rooted: Food Waste Reduction through Surplus Food Redistribution
**MSIS Group Assignment Project | Applied Data Science, Database & Visualisation Platform**

A full-stack, data-driven web application combining an ACID-compliant relational DBMS (**PostgreSQL 18**), an automated data science analytics pipeline (**Pandas**), and an interactive executive decision dashboard (**Plotly.js + Three.js**).

---

## 1. System Overview & Working Artifacts

This repository provides all required working artifacts for the 50-mark MSIS evaluation:

| Component | Working Artifact | Description |
| --- | --- | --- |
| **Component 1: Fundamentals** | [`PROJECT_DOCUMENTATION_AND_DEFENSE.md`](PROJECT_DOCUMENTATION_AND_DEFENSE.md) | Full problem statement, stakeholder analysis, end-to-end workflow, scalability architecture, and KPI definitions. |
| **Component 2: Database** | [`schema_postgres.sql`](schema_postgres.sql), [`queries.sql`](queries.sql), [`food_redistribution_dump.sql`](food_redistribution_dump.sql) | 3NF PostgreSQL 18 schema, primary/foreign key constraints, audit sequences, and business analytical queries with multi-table joins. |
| **Component 3: Visualisation** | [`analysis.py`](analysis.py), [`templates/dashboard.html`](templates/dashboard.html), [`static/app.js`](static/app.js) | Dynamic decision dashboard, date-filtered KPI cards, stacked bar food category visualization, claim status donuts, and daily volume timelines. |
| **Web Platform & Security** | [`app.py`](app.py), [`templates/`](templates/), [`static/`](static/) | Role-Based Access Control (RBAC), 10-item pagination, responsive design, live clock, and data model inspector. |

---

## 2. Key Performance Indicators (KPIs)

| KPI Name | Baseline | Target | Measurement Window | Data Source |
| --- | --- | --- | --- | --- |
| **Food Diversion Rate (%)** | 45.0% | **75.0%** | Monthly | `SUM(claims.claimed_kg WHERE status IN ('Completed','Collected')) / SUM(food_listings.quantity_kg)` |
| **Redistributed Surplus (kg)** | 5,000 kg | **15,000 kg** | Monthly | `SUM(claims.claimed_kg WHERE status IN ('Completed','Collected'))` |
| **Claim Fulfillment Rate (%)** | 60.0% | **85.0%** | Monthly | `COUNT(claims WHERE status IN ('Completed','Collected')) / COUNT(claims)` |
| **Provider Network Breadth** | 20 active | **80+ active** | Monthly | `COUNT(DISTINCT food_listings.provider_id)` |
| **Average Claim Turnaround** | 48 hours | **< 12 hours** | Rolling 30 Days | `AVG(claims.pickup_at - claims.claimed_at)` |

---

## 3. Database Architecture (PostgreSQL 18)

- **Engine:** PostgreSQL 18 on `localhost:5432 / food_redistribution`
- **Normalization:** 3NF (Third Normal Form) eliminating redundant attributes and update anomalies.
- **Tables & Cardinality:**
  - `providers` (1) ───< `food_listings` (M)
  - `food_listings` (1) ───< `claims` (M)
  - `receivers` (1) ───< `claims` (M)
  - `users` (M) ───< `providers` / `receivers` (Optional 1: Role-based platform users)
- **Active Records:**
  - `providers`: 121 records (including TAPMI Campus Dining, Manipal)
  - `receivers`: 200 registered NGOs and community kitchens
  - `food_listings`: 1,606 surplus listings across multiple categories
  - `claims`: 1,400 logged distribution requests
  - `users`: 125 credentialed user accounts

---

## 4. Demo Login Credentials

The application enforces Role-Based Access Control (RBAC):

| Role | Login Username | Password | Accessible Interfaces |
| --- | --- | --- | --- |
| **Administrator** | `admin@rooted.local` | `admin123` | Overview Dashboard, Listings, Claims, Data Model (`/data`), Operational Feed |
| **Food Provider (TAPMI)** | `tapmi@rooted.local` | `tapmi123` | TAPMI Campus Dining Dashboard, Benchmark Ranking, Add Surplus (`/listings/new`) |
| **Food Provider (Retail)** | `provider@rooted.local` | `provider123` | Grocery Donor Dashboard, Benchmark Ranking, Add Surplus (`/listings/new`) |
| **NGO Receiver** | `ngo@rooted.local` | `ngo123` | Public Surplus Feed, Claim Initiation (`/listings/<id>/claim`), Pickup Tracking |

*Note: Additional provider accounts follow `provider<ID>@rooted.local` with password `provider123`.*

---

## 5. Local Setup & Execution

### Prerequisites
- Python 3.10+
- PostgreSQL 18 running on `localhost:5432` with database `food_redistribution`

### Setup Steps
```powershell
# 1. Clone/navigate to project directory
cd "C:\Users\anura\OneDrive - Manipal Academy of Higher Education\Desktop\MSIS PROJECT"

# 2. Configure environment variables in .env (already configured)
# DB_TYPE=postgres
# PGHOST=localhost
# PGPORT=5432
# PGDATABASE=food_redistribution
# PGUSER=postgres
# PGPASSWORD=12345

# 3. Install dependencies
pip install -r requirements.txt

# 4. Start the application
python app.py
```

Open **`http://127.0.0.1:5000`** in your browser.

---

## 6. Project Directory Layout

```text
├── app.py                          # Flask application routes, session management, and RBAC
├── analysis.py                     # Pandas analytics engine, temporal filtering, and KPI aggregations
├── db.py                           # PostgreSQL 18 connection wrapper with SQLite fallback
├── schema_postgres.sql             # PostgreSQL 18 DDL schema script
├── queries.sql                     # Analytical SQL query catalog demonstrating multi-table joins
├── food_redistribution_dump.sql    # Complete SQL dump of all tables, sequences, and migrated data
├── templates/                      # Responsive Jinja2 templates (dashboard, listings, claims, data model)
│   ├── base.html                   # Master layout with 3D ambient background and real-time digital clock
│   ├── dashboard.html              # Executive decision dashboard with Plotly charts and date filter
│   ├── listings.html               # Paginated food surplus catalog with search and filters
│   ├── claims.html                 # Paginated claims and pickup ledger
│   ├── data.html                   # PostgreSQL data dictionary inspector
│   ├── login.html                  # Role-based secure sign-in
│   └── new_listing.html            # Provider surplus creation form
├── static/
│   ├── app.js                      # Plotly chart renderers, Three.js spatial background, and AJAX filters
│   └── style.css                   # Custom responsive CSS design system
└── PROJECT_DOCUMENTATION_AND_DEFENSE.md # Comprehensive academic proposal & oral exam defense guide
```
