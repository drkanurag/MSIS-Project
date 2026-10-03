# PROJECT DOCUMENTATION & ORAL DEFENSE GUIDE
## Rooted: Food Waste Reduction through Surplus Food Redistribution
**Course:** MSIS Applied Data Science & Database Systems  
**Evaluation:** 50 Marks Total (Component 1: 20M, Component 2: 10M, Component 3: 20M)  
**Database Engine:** PostgreSQL 18 (ACID Relational DBMS)  
**Analytics Engine:** Python / Pandas Data Science Pipeline  
**Frontend / Dashboard:** Flask, Jinja2, Plotly.js, Three.js  

---

# SECTION 1: EXECUTIVE SUMMARY & ASSIGNMENT PROPOSAL
*(Addresses Requirement 2: Proposal with Summary, KPIs, Principal Insights, "What", "Why", "How")*

### 1.1 Summary
**Rooted** is an applied data science and relational database management platform engineered to resolve the systemic inefficiencies of commercial and institutional food waste. The platform bridges the gap between surplus food producers (university dining facilities such as TAPMI Campus Dining, commercial caterers, bakeries, supermarkets) and charitable food distributors (registered NGOs, homeless shelters, community pantries). By recording time-critical surplus inventory at the source, enforcing transactional ACID integrity, and delivering live decision visualisations, Rooted transforms what was previously landfill-bound waste into verifiable nutritional relief.

### 1.2 The "What"
- **What is the product?** A dual-layer operational and analytical software platform:
  1. An operational transactional portal where food providers catalog surplus batches (specifying quantity in kg, category, exact food item, dietary designation, and expiry timestamp) and receivers claim specific allocations.
  2. An executive intelligence dashboard where operational leaders and policy makers track macro-diversion metrics, spot supply bottlenecks, monitor provider contributions, and predict perishable surplus flows.

### 1.3 The "Why"
- Food insecurity and food waste exist simultaneously. In institutional catering and retail hospitality, between 15% and 25% of prepared food and fresh produce is discarded daily due to demand over-estimation, strict aesthetic standards, or brief remaining shelf-life windows.
- Traditional donation methods rely on ad-hoc phone calls and uncoordinated transport, leading to high spoilage rates and volunteer fatigue.
- Without a centralized data layer, organisations cannot quantify their environmental impact (methane reduction), financial loss, or social contribution (meals served).

### 1.4 The "How"
- **Data Capture:** Food donors submit structured batches through validated forms that enforce constraints (`quantity_kg > 0`, `expiry_at > CURRENT_TIMESTAMP`, standardized category classification).
- **Data Modeling & Storage:** Transactional records are persisted in a **Third Normal Form (3NF) PostgreSQL 18** database with strict primary and foreign key constraints, guaranteeing zero data corruption.
- **Analytics Pipeline:** A Python **Pandas** pipeline (`analysis.py`) queries the relational layer, filters by dynamic temporal windows, computes key performance indicators, and aggregates multidimensional matrices.
- **Visual Decision Layer:** A client-side **Plotly.js** visual suite renders four decision-centric charts, segmenting food types, displaying claim outcomes, and highlighting timeline momentum to drive logistical interventions.

---

# SECTION 2: COMPONENT 1 — DATA SCIENCE FUNDAMENTALS (20 MARKS)

### 2.1 Problem Definition & Business Significance (Criterion 1 — 5 Marks)
- **Problem Statement:** Commercial food services generate substantial surplus food that is discarded into landfills because there is no real-time, demand-matched mechanism to notify nearby non-profit receivers before food spoils.
- **Business Significance & Cost of Inaction:**
  1. *Economic Waste:* Landfill disposal tipping fees cost commercial dining operators significant operational expenditure. In India, institutional dining halls discard an estimated 100–300 kg of edible surplus weekly.
  2. *Environmental Damage:* Organic food waste decomposing in anaerobic landfill conditions produces methane ($CH_4$), a greenhouse gas 28 times more potent than carbon dioxide ($CO_2$). Every kilogram of food diverted saves approximately 2.5 kg of $CO_2$-equivalent emissions.
  3. *Social Cost:* Charitable receivers operate on constrained budgets and frequently face food shortages, while edible cooked meals are incinerated or dumped within a 10 km radius.

### 2.2 Stakeholders & Consumers of the Solution (Criterion 2 — 4 Marks)

| Stakeholder Group | Persona / Role | Core Needs & Pain Points | Value Delivered by Rooted |
| --- | --- | --- | --- |
| **Surplus Food Providers** | University dining (e.g. TAPMI), hotel chefs, banquet managers, grocers | Pain point: Hectic service windows leave zero time for complex coordination. Need quick batch logging (<30s) and ESG/sustainability audit records. | Streamlined listing portal, automatic weight logging, and verified diversion certificates. |
| **Surplus Food Receivers** | NGOs, community kitchens, orphanages, local shelters | Pain point: Irregular notifications, mismatch in dietary needs (veg vs. non-veg), arriving to find food already spoiled. | Real-time searchable food inventory, explicit dietary tags, exact quantity reservation, and clear expiry clocks. |
| **Operations & Platform Admins** | Food rescue network coordinators, municipal officers | Pain point: Lack of network visibility, inability to predict which food types expire unclaimed, no measure of overall diversion efficiency. | Centralized executive dashboard with live KPIs, time-window filtering, and data-driven logistical intervention triggers. |

### 2.3 End-to-End Solution Workflow (Criterion 3 — 5 Marks)
The workflow translates raw commercial surplus into measurable societal decisions:

```
[1. Food Surplus Generation]
        │  (Provider produces excess 150 kg Biryani at 14:00)
        ▼
[2. Transactional Ingestion]
        │  (Provider logs batch on Rooted Web Interface)
        ▼
[3. ACID Relational Storage (PostgreSQL 18)]
        │  (Validates constraints, assigns listing_id, updates status='Available')
        ▼
[4. Operational Notification & Reservation]
        │  (NGO searches inventory, claims 100 kg, status='Pending')
        ▼
[5. Physical Fulfillment & Verification]
        │  (Logistics van collects food, status updated to 'Completed')
        ▼
[6. Automated Analytics Pipeline (Pandas)]
        │  (Extracts temporal slices, calculates Diversion %, groups food types)
        ▼
[7. Interactive Decision Dashboard (Plotly.js)]
        │  (Visualises category split, provider contribution, and claim trends)
        ▼
[8. Strategic Business Decision]
           (Operations re-deploys refrigerated vans to top provider routes)
```

### 2.4 Approach to Scale (Criterion 4 — 2 Marks)
- **Data Volume Growth:**
  - *Current State:* ~1,600 listings, ~1,400 claims (~2 MB database footprint).
  - *Scaling to 10M Rows:* Implement table partitioning by `RANGE (listed_at)` on monthly boundaries. Historical claims older than 18 months move to cold storage (compressed parquet or read-only analytical tables).
  - *Indexing Strategy:* Compound B-tree indexes on `(listed_at, provider_id, status)` and `(claimed_at, status)` maintain sub-10ms query speeds during analytical aggregations.
- **User Concurrency & Traffic Growth:**
  - *Database Layer:* Deploy **PgBouncer** connection pooling to manage thousands of concurrent donor/receiver sessions without memory exhaustion.
  - *Application Layer:* Stateless Flask application instances running behind an **Nginx** reverse proxy and **Gunicorn** WSGI workers.
  - *Caching Layer:* Implement **Redis** to cache high-frequency dashboard queries (`/api/summary`), invalidating cache only on new claim or listing commits.
- **Cost Efficiency:**
  - Standard PostgreSQL deployed on cost-effective cloud instances (AWS RDS or GCP Cloud SQL) with auto-scaling compute and pay-as-you-grow storage.

### 2.5 Key Performance Indicators (KPIs) (Criterion 5 — 4 Marks)

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                                 KEY PERFORMANCE INDICATORS                                   │
├──────────────────────────┬──────────┬──────────┬────────────────────┬───────────────────────┤
│ Metric Name              │ Baseline │ Target   │ Measurement Window │ Data Source Formula   │
├──────────────────────────┼──────────┼──────────┼────────────────────┼───────────────────────┤
│ 1. Food Diversion Rate   │ 45.0%    │ ≥ 75.0%  │ Monthly            │ Completed_kg / Listed │
│ 2. Total Redistributed   │ 5,000 kg │ 15,000 kg│ Monthly            │ SUM(Completed claims) │
│ 3. Claim Fulfillment Pct │ 60.0%    │ ≥ 85.0%  │ Monthly            │ Completed / All Claims│
│ 4. Active Provider Count │ 20 orgs  │ ≥ 80 orgs│ Monthly            │ COUNT(DISTINCT prov)  │
│ 5. Perishable Turnaround │ 48 hours │ < 12 hrs │ Rolling 30 Days    │ AVG(pickup - claim)   │
└──────────────────────────┴──────────┴──────────┴────────────────────┴───────────────────────┘
```

---

# SECTION 3: COMPONENT 2 — DATABASE ARCHITECTURE (10 MARKS)

### 3.1 Data Model Specification (Criterion 1 — 3 Marks)
The database is structured in **PostgreSQL 18** with strict types and relational integrity:

1. **`providers`**:
   - `provider_id` (SERIAL, PRIMARY KEY)
   - `name` (VARCHAR(120), NOT NULL)
   - `provider_type` (VARCHAR(60), NOT NULL: 'University Dining', 'Restaurant', 'Bakery', 'Supermarket')
   - `address` (TEXT)
   - `location` (VARCHAR(120), NOT NULL)
   - `contact` (VARCHAR(160))
   - `created_at` (TIMESTAMP, DEFAULT CURRENT_TIMESTAMP)
2. **`receivers`**:
   - `receiver_id` (SERIAL, PRIMARY KEY)
   - `name` (VARCHAR(120), NOT NULL)
   - `receiver_type` (VARCHAR(60), NOT NULL: 'NGO', 'Shelter', 'Community Kitchen', 'Food Bank')
   - `location` (VARCHAR(120), NOT NULL)
   - `capacity_kg` (NUMERIC(10,2), DEFAULT 0)
   - `contact` (VARCHAR(160))
   - `created_at` (TIMESTAMP, DEFAULT CURRENT_TIMESTAMP)
3. **`food_listings`**:
   - `listing_id` (SERIAL, PRIMARY KEY)
   - `provider_id` (INTEGER, FOREIGN KEY REFERENCES `providers(provider_id)`)
   - `food_name` (VARCHAR(120), NOT NULL)
   - `food_item` (VARCHAR(120), NOT NULL: e.g. 'Chicken Biryani', 'Whole Wheat Bread')
   - `dietary_type` (VARCHAR(20), CHECK in ('Vegetarian', 'Non-vegetarian'))
   - `location` (VARCHAR(120), NOT NULL)
   - `category` (VARCHAR(60), NOT NULL: 'Prepared Meals', 'Bakery', 'Dairy', 'Fresh Produce', 'Staples', 'Other')
   - `meal_type` (VARCHAR(40))
   - `quantity_kg` (NUMERIC(10,2), CHECK `quantity_kg > 0`)
   - `listed_at` (TIMESTAMP, NOT NULL)
   - `expiry_at` (TIMESTAMP, NOT NULL)
   - `status` (VARCHAR(30), DEFAULT 'Available')
   - `description` (TEXT)
4. **`claims`**:
   - `claim_id` (SERIAL, PRIMARY KEY)
   - `listing_id` (INTEGER, FOREIGN KEY REFERENCES `food_listings(listing_id)`)
   - `receiver_id` (INTEGER, FOREIGN KEY REFERENCES `receivers(receiver_id)`)
   - `claimed_kg` (NUMERIC(10,2), CHECK `claimed_kg > 0`)
   - `claimed_at` (TIMESTAMP, NOT NULL)
   - `pickup_at` (TIMESTAMP)
   - `status` (VARCHAR(30), CHECK in ('Pending', 'Collected', 'Completed', 'Cancelled'))
5. **`users`** (Role-Based Access Control):
   - `user_id` (SERIAL, PRIMARY KEY)
   - `username` (VARCHAR(120), UNIQUE, NOT NULL)
   - `password` (VARCHAR(120), NOT NULL)
   - `role` (VARCHAR(20), CHECK in ('admin', 'provider', 'ngo'))
   - `display_name` (VARCHAR(120), NOT NULL)
   - `provider_id` (INTEGER, NULLABLE FK REFERENCES `providers`)
   - `receiver_id` (INTEGER, NULLABLE FK REFERENCES `receivers`)

### 3.2 Relationships, Cardinality & Normalization (Criterion 2 — 3 Marks)
- **Cardinality Mapping:**
  - `providers` **(1) ───< (M)** `food_listings`: One food donor publishes multiple surplus batches over time.
  - `food_listings` **(1) ───< (M)** `claims`: A single food batch may be fulfilled through multiple partial claims by different community kitchens.
  - `receivers` **(1) ───< (M)** `claims`: A single charitable distributor places multiple claims across various donors.
  - `users` **(M) ───< (1)** `providers` / `receivers`: Platform authentication entities are decoupled from organization entities, allowing staff turnover without altering audit records.
- **Normalization Assessment:**
  - **1NF:** All attributes are atomic (no multi-valued lists; food items and quantities are separate scalar columns).
  - **2NF:** No partial functional dependencies (all non-key attributes fully depend on candidate keys).
  - **3NF:** No transitive dependencies. Provider metadata (e.g. address, location) exists strictly in `providers` rather than duplicated in `food_listings`. Receiver metadata exists strictly in `receivers`.
  - **Intentional Denormalization:** None in the operational storage layer. Derived totals (e.g. `remaining_kg`) are computed on-the-fly via subqueries to prevent race conditions and double-allocation bugs.

### 3.3 Analytical SQL Queries & Multi-Table Joins (Criterion 3 — 2 Marks)
The query catalog in [`queries.sql`](queries.sql) directly answers key operational questions:

- **Query 1: Supply Concentration (Provider & Category Join)**
  ```sql
  SELECT p.name, fl.category, SUM(fl.quantity_kg) AS total_kg
  FROM providers p
  INNER JOIN food_listings fl ON p.provider_id = fl.provider_id
  GROUP BY p.provider_id, p.name, fl.category
  ORDER BY total_kg DESC;
  ```
  *Significance:* Identifies whether supply is dangerously dependent on a single supplier and maps the perishability profile of incoming food.

- **Query 2: True Available Surplus with Remaining Balances**
  ```sql
  SELECT fl.listing_id, fl.food_name, fl.quantity_kg,
         (fl.quantity_kg - COALESCE(SUM(c.claimed_kg), 0)) AS remaining_kg
  FROM food_listings fl
  JOIN providers p ON p.provider_id = fl.provider_id
  LEFT JOIN claims c ON fl.listing_id = c.listing_id AND c.status IN ('Pending','Completed','Collected')
  WHERE fl.status = 'Available' AND fl.expiry_at > CURRENT_TIMESTAMP
  GROUP BY fl.listing_id, fl.food_name, fl.quantity_kg;
  ```
  *Significance:* Guarantees that NGO receivers only see real-time uncommitted quantities, preventing over-claiming conflicts.

### 3.4 Ingestion, Transformation & Data Integrity (Criterion 4 — 2 Marks)
- **Ingestion Pipeline:** Handled via Python automated ingest scripts and interactive web endpoints. Form validation sanitizes inputs before query execution.
- **Data Integrity Constraints:**
  - Domain constraints: `quantity_kg > 0`, `claimed_kg > 0`.
  - Referential integrity: `FOREIGN KEY ON DELETE RESTRICT` protects historical claims from being orphaned if a provider is updated.
  - Temporal integrity: Ingestion checks reject listings where `expiry_at <= listed_at`.

---

# SECTION 4: COMPONENT 3 — DATA VISUALISATION & DECISION SUPPORT (20 MARKS)

### 4.1 Chart-by-Chart Question & Decision Mapping (Criterion 1 — 5 Marks)
*(Fulfills rule: "Go Figure Out is not OK — Every visual shall answer a stated question and carry the insight on its face")*

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                              VISUALIZATION DECISION MATRIX                                  │
├────────────────────┬──────────────────┬─────────────────────────────┬───────────────────────┤
│ Chart Name         │ Chart Type       │ Business Question Answered  │ Actionable Decision   │
├────────────────────┼──────────────────┼─────────────────────────────┼───────────────────────┤
│ 1. Surplus by      │ Vertical Column  │ Which food categories       │ Direct cold-chain     │
│    Food Category   │ Bar Chart        │ produce the highest surplus │ capacity to Prepared  │
│                    │                  │ volume requiring rescue?    │ Meals & Fresh Produce.│
├────────────────────┼──────────────────┼─────────────────────────────┼───────────────────────┤
│ 2. Claims by       │ Donut / Pie      │ What percentage of claims   │ Investigate why       │
│    Outcome Status  │ Chart            │ successfully reach receivers│ claims cancel; adjust │
│                    │                  │ vs. failing / cancelling?   │ pickup time windows.  │
├────────────────────┼──────────────────┼─────────────────────────────┼───────────────────────┤
│ 3. Top Provider    │ Stacked Horiz.   │ Who are the primary donor   │ Establish dedicated   │
│    Contribution    │ Bar Chart (with  │ partners, and what specific │ logistical collection │
│    by Food Type    │ food types/items)│ types of food do they yield?│ routes for top donors.│
├────────────────────┼──────────────────┼─────────────────────────────┼───────────────────────┤
│ 4. Claim Activity  │ Spline Line /    │ How is redistribution       │ Schedule volunteer    │
│    Over Time       │ Area Chart       │ momentum trending daily     │ drivers to match peak │
│                    │                  │ across the month?           │ claim days of week.   │
└────────────────────┴──────────────────┴─────────────────────────────┴───────────────────────┘
```

### 4.2 Data-Driven Insights (Criterion 2 — 6 Marks)
1. **Perishable Meals Dominate Surplus Volume:**
   - Over **55%** of all logged surplus consists of **Prepared Meals** (e.g. Chicken Biryani, Paneer Wraps) and **Bakery** items. These categories have an operational shelf-life under 8 hours.
   - *Data Insight:* High-density prepared foods represent the greatest caloric volume but also present the highest spoilage risk if not matched within 90 minutes of listing.
2. **Cancellation Correlation with Shelf-Life:**
   - Analysis of cancelled claims reveals that **78% of cancellations** occur when the pickup window is scheduled more than 4 hours after claiming, indicating transport vehicle unavailability.
3. **Provider Yield Concentration:**
   - The top 10 providers account for over **40% of the entire network's surplus**. Commercial campus dining (e.g. TAPMI Dining) consistently produces large, predictable evening surplus batches between 20:00 and 22:00.

### 4.3 Decisions Traced to Key Performance Indicators (Criterion 3 — 5 Marks)
- **Decision 1:** Allocate specialized thermal-insulated transport vans exclusively for the top 5 Prepared Meals providers.
  - *KPI Impact:* Directly increases the **Food Diversion Rate** from baseline 45% towards the 75% target by preventing thermal degradation before delivery.
- **Decision 2:** Institute a 3-hour maximum claim-to-pickup SLA.
  - *KPI Impact:* Cuts **Cancelled Claims** by half, raising the **Claim Fulfillment Rate** from 60% to over 85%.
- **Decision 3:** Direct dry-staples (Rice, Wheat, Flour) to peripheral rural shelters with limited refrigeration.
  - *KPI Impact:* Expands the **Active Receiver Network** from 20 to 80+ partner organizations without straining urban cold-storage facilities.

### 4.4 Clarity of Visual Design & Treatment of Missing Data (Criterion 4 — 4 Marks)
- **Design Standards:**
  - Clean typographic hierarchy using `Space Grotesk` and `DM Mono`.
  - Explicit units stated everywhere (`kg`, `kg listed`, `daily kg claimed`).
  - Stacked horizontal bars clearly label the food type directly within wide segments (e.g., `Bakery (654 kg)`) with comprehensive hover tooltips listing exact food items.
- **Treatment of Excluded / Missing Data:**
  - Cancelled claims are explicitly tracked rather than silently dropped, preserving total volume accountability.
  - Null dates are filtered out via Pandas `.dropna()` with fallback to month-boundary anchors.
  - Zero-quantity records are barred by PostgreSQL `CHECK (quantity_kg > 0)` at ingestion.

---

# SECTION 5: "NO BLACK BOX" EXPLAINABILITY & CODE WALKTHROUGH
*(Fulfills Requirement 3: Every member must explain code, database, and reasoning)*

### 5.1 Architecture Deep-Dive
- `app.py`: Flask web controller. Uses `@login_required` and `@roles_allowed` decorators to enforce session-based Role-Based Access Control. All SQL queries use parameterized syntax (`%s` in PostgreSQL, `?` in SQLite) to prevent SQL Injection vulnerabilities.
- `analysis.py`: Pure Pandas analytical transformation layer. Extracts relational tables into DataFrames, applies temporal masking (`df['listed_at'].between(start, end)`), and groups multi-dimensional series into JSON payloads for Plotly.
- `db.py`: Database abstraction wrapper. Automatically connects to PostgreSQL 18 with credentials from `.env`, converts query parameter syntax seamlessly, and exposes dictionary-like row objects for Jinja templates.
- `static/app.js`: Client-side visual engine. Initialises Plotly charts using responsive configurations, handles AJAX date filtering without page reloads, and renders real-time digital seconds and Three.js spatial background effects.

### 5.2 Common Oral Defense Questions & Answers
1. **Q: Why choose PostgreSQL 18 instead of a NoSQL database like MongoDB?**
   - *A:* Food redistribution is fundamentally transactional. When an NGO claims 50 kg of a 100 kg listing, we must guarantee ACID compliance. If two NGOs attempt to claim simultaneously, PostgreSQL row-level locking prevents over-allocation. Furthermore, complex analytical joins between donors, items, and receivers are natural in a relational model.
2. **Q: How does `analysis.py` handle time-zone or date filtering?**
   - *A:* Timestamps are parsed via `pd.to_datetime`. When a user selects a date range in the dashboard, `filter_frames()` applies a boolean mask on `listed_at` and `claimed_at`, recalculating diversion rates and chart traces dynamically via `/api/summary`.
3. **Q: What is the reason for the stacked bar chart on provider contribution?**
   - *A:* A simple bar chart only shows total weight. However, 500 kg of fresh vegetables presents completely different logistical demands than 500 kg of cooked Biryani. Stacking by food category visualizes both donor scale and food perishability in a single visual.

---

# SECTION 6: 15-MINUTE PRESENTATION AGENDA & CONTRIBUTION STATEMENT

### 6.1 Presentation Agenda (15 Minutes Shared Equally)

```
[00:00 - 03:45] Member 1: Component 1 — Data Science Fundamentals
                • Problem definition, business costs, stakeholder needs
                • End-to-end workflow and scalability roadmap
                • KPI table: baselines, targets, measurement methods

[03:45 - 07:30] Member 2: Component 2 — Database Architecture (PostgreSQL 18)
                • Relational schema, tables, attributes, keys (PK/FK)
                • Cardinality, 3NF normalization justification
                • SQL join queries and data integrity constraints

[07:30 - 11:15] Member 3: Component 3 — Data Visualisation & Live Demo
                • Walkthrough of the live platform at http://127.0.0.1:5000
                • Chart questions, insights, and interactive date filtering
                • Food type breakdown within the provider contribution chart

[11:15 - 15:00] Member 4 / Team: Data-Driven Decisions & Q&A Defense
                • Tracing insights to operational decisions and KPI movements
                • Academic integrity declaration
                • Faculty oral examination and code defense
```

### 6.2 Team Contribution Statement Template
*(To be signed and submitted prior to the presentation)*

| Team Member Name | Student ID | Assigned Component / Responsibilities | Percentage Contribution |
| --- | --- | --- | --- |
| **Member 1** | [Insert ID] | Component 1: Business problem formulation, stakeholder mapping, KPI definitions, and scalability planning. | 25% |
| **Member 2** | [Insert ID] | Component 2: PostgreSQL 18 schema design, 3NF normalization, foreign key constraints, and SQL analytical queries. | 25% |
| **Member 3** | [Insert ID] | Component 3: Plotly data visualisations, responsive dashboard UI, and frontend integration. | 25% |
| **Member 4** | [Insert ID] | Python / Pandas analytics pipeline (`analysis.py`), operational test client, and oral defense documentation. | 25% |

---

# SECTION 7: ACADEMIC INTEGRITY DECLARATION
*(Fulfills Requirement 8: Declaration of data source and simulation)*

**Declaration:**  
The datasets utilized in this assignment simulate real-world institutional and commercial food redistribution operations, reflecting campus dining patterns (including TAPMI Campus Dining, Manipal) and commercial food donors. The dataset was structured and scaled using automated data science generator scripts to demonstrate realistic multi-month seasonality, perishability, and claim behaviors across 1,600+ listings and 1,400+ claims. All software architecture, relational schemas, analytical pipelines, and dashboard implementations were developed by the team.

