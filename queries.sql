-- ============================================================================
-- ROOTED: FOOD SURPLUS REDISTRIBUTION MANAGEMENT SYSTEM
-- Component 2: Database Query Catalog & Analytical Query Demonstrations
-- Database Engine: PostgreSQL 18
-- ============================================================================

-- ----------------------------------------------------------------------------
-- QUERY 1: Top Provider Contribution by Food Category and Volume
-- Business Question:
--   "Which donor organisations supply the largest surplus volumes, and what
--    specific food categories dominate their supply?"
-- Tables Connected:
--   providers p (PK provider_id)
--   food_listings fl (FK provider_id)
-- Joins Used:
--   INNER JOIN on p.provider_id = fl.provider_id
-- Result Produced:
--   Provider name, food category, count of listings, and aggregated kg.
-- ----------------------------------------------------------------------------
SELECT 
    p.name AS provider_name,
    p.location AS provider_city,
    fl.category AS food_category,
    COUNT(fl.listing_id) AS total_batches,
    ROUND(SUM(fl.quantity_kg)::numeric, 1) AS total_kg_listed
FROM providers p
INNER JOIN food_listings fl ON p.provider_id = fl.provider_id
GROUP BY p.provider_id, p.name, p.location, fl.category
ORDER BY total_kg_listed DESC
LIMIT 15;


-- ----------------------------------------------------------------------------
-- QUERY 2: Food Diversion & Claim Fulfillment Rate
-- Business Question:
--   "What is our platform-wide food diversion efficiency, and how much food
--    has been successfully diverted from landfills to receivers?"
-- Tables Connected:
--   food_listings fl (Master surplus inventory)
--   claims c (Subordinate receiver requests)
-- Joins Used:
--   LEFT JOIN to preserve listings that have not yet been claimed
-- Result Produced:
--   Total listed kg, total claimed kg, successfully collected kg, and diversion %.
-- ----------------------------------------------------------------------------
SELECT 
    ROUND(SUM(fl.quantity_kg)::numeric, 1) AS total_listed_kg,
    ROUND(SUM(CASE WHEN c.status IN ('Completed', 'Collected') THEN c.claimed_kg ELSE 0 END)::numeric, 1) AS diverted_kg,
    ROUND(SUM(CASE WHEN c.status = 'Cancelled' THEN c.claimed_kg ELSE 0 END)::numeric, 1) AS lost_claimed_kg,
    ROUND(
        (SUM(CASE WHEN c.status IN ('Completed', 'Collected') THEN c.claimed_kg ELSE 0 END) / 
        NULLIF(SUM(fl.quantity_kg), 0) * 100)::numeric, 2
    ) AS diversion_rate_percentage
FROM food_listings fl
LEFT JOIN claims c ON fl.listing_id = c.listing_id;


-- ----------------------------------------------------------------------------
-- QUERY 3: Real-Time Available Inventory with Remaining Balance
-- Business Question:
--   "Which food listings are currently active and available for claiming, and
--    what is the true remaining quantity after deducting active/completed claims?"
-- Tables Connected:
--   food_listings fl
--   providers p
--   claims c (via correlated subquery for non-cancelled reservations)
-- Joins Used:
--   INNER JOIN between food_listings and providers
-- Result Produced:
--   Listing details, provider name, original kg, claimed kg, and remaining balance.
-- ----------------------------------------------------------------------------
SELECT 
    fl.listing_id,
    fl.food_name,
    fl.food_item,
    fl.category,
    fl.dietary_type,
    p.name AS provider_name,
    fl.quantity_kg AS initial_quantity_kg,
    COALESCE(claimed_summary.claimed_total, 0) AS committed_kg,
    (fl.quantity_kg - COALESCE(claimed_summary.claimed_total, 0)) AS remaining_kg,
    fl.status,
    fl.expiry_at
FROM food_listings fl
INNER JOIN providers p ON p.provider_id = fl.provider_id
LEFT JOIN (
    SELECT listing_id, SUM(claimed_kg) AS claimed_total
    FROM claims
    WHERE status IN ('Pending', 'Completed', 'Collected')
    GROUP BY listing_id
) claimed_summary ON fl.listing_id = claimed_summary.listing_id
WHERE fl.status = 'Available' 
  AND fl.expiry_at > CURRENT_TIMESTAMP
  AND (fl.quantity_kg - COALESCE(claimed_summary.claimed_total, 0)) > 0
ORDER BY fl.expiry_at ASC
LIMIT 20;


-- ----------------------------------------------------------------------------
-- QUERY 4: Receiver Redistribution Performance & Impact
-- Business Question:
--   "Which community receivers (NGOs, shelters, food banks) have diverted the
--    most surplus food, and what is their collection reliability?"
-- Tables Connected:
--   receivers r (PK receiver_id)
--   claims c (FK receiver_id)
-- Joins Used:
--   INNER JOIN on r.receiver_id = c.receiver_id
-- Result Produced:
--   Receiver organisation name, total claims made, total kg collected, and success rate.
-- ----------------------------------------------------------------------------
SELECT 
    r.name AS receiver_name,
    r.receiver_type,
    r.location AS receiver_location,
    COUNT(c.claim_id) AS total_claims_placed,
    COUNT(CASE WHEN c.status IN ('Completed', 'Collected') THEN 1 END) AS successful_pickups,
    ROUND(SUM(CASE WHEN c.status IN ('Completed', 'Collected') THEN c.claimed_kg ELSE 0 END)::numeric, 1) AS total_collected_kg,
    ROUND(
        (COUNT(CASE WHEN c.status IN ('Completed', 'Collected') THEN 1 END)::numeric / 
        NULLIF(COUNT(c.claim_id), 0) * 100), 1
    ) AS collection_success_rate_pct
FROM receivers r
INNER JOIN claims c ON r.receiver_id = c.receiver_id
GROUP BY r.receiver_id, r.name, r.receiver_type, r.location
HAVING COUNT(c.claim_id) >= 5
ORDER BY total_collected_kg DESC
LIMIT 15;


-- ----------------------------------------------------------------------------
-- QUERY 5: Waste Bottleneck Analysis (Expired Unclaimed Surplus)
-- Business Question:
--   "What food categories and dietary types suffer the highest expiration rate
--    without being claimed by any receiver?"
-- Tables Connected:
--   food_listings fl
--   claims c
-- Joins Used:
--   LEFT JOIN to detect listings with zero successful claims
-- Result Produced:
--   Category, dietary type, expired listings count, and wasted kg.
-- ----------------------------------------------------------------------------
SELECT 
    fl.category,
    fl.dietary_type,
    COUNT(DISTINCT fl.listing_id) AS expired_batches_count,
    ROUND(SUM(fl.quantity_kg)::numeric, 1) AS total_expired_kg
FROM food_listings fl
LEFT JOIN claims c ON fl.listing_id = c.listing_id AND c.status IN ('Completed', 'Collected')
WHERE fl.status = 'Expired' OR (fl.expiry_at < CURRENT_TIMESTAMP AND c.claim_id IS NULL)
GROUP BY fl.category, fl.dietary_type
ORDER BY total_expired_kg DESC;
