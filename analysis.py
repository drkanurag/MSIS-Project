import os
import pandas as pd
import sqlalchemy
from db import get_db


def _get_engine_or_conn():
    connection = get_db()
    if getattr(connection, "is_postgres", False):
        user = os.environ.get("PGUSER", "postgres")
        pwd = os.environ.get("PGPASSWORD", "12345")
        host = os.environ.get("PGHOST", "localhost")
        port = os.environ.get("PGPORT", "5432")
        dbname = os.environ.get("PGDATABASE", "food_redistribution")
        engine = sqlalchemy.create_engine(f"postgresql+psycopg2://{user}:{pwd}@{host}:{port}/{dbname}")
        connection.close()
        return engine, True
    return connection, False


def load_frames(provider_id=None):
    source, is_pg = _get_engine_or_conn()
    param_placeholder = "%(pid)s" if is_pg else "?"
    params = {"pid": provider_id} if is_pg and provider_id else ((provider_id,) if provider_id else None)

    listings_query = (
        "SELECT fl.*, p.name AS provider, p.provider_type, p.location AS provider_location FROM food_listings fl JOIN providers p ON p.provider_id = fl.provider_id"
        + (f" WHERE fl.provider_id = {param_placeholder}" if provider_id else "")
    )
    claims_query = (
        "SELECT c.*, r.name AS receiver, r.receiver_type, fl.food_name, fl.category FROM claims c JOIN receivers r ON r.receiver_id = c.receiver_id JOIN food_listings fl ON fl.listing_id = c.listing_id"
    )

    if is_pg:
        with source.connect() as conn:
            listings = pd.read_sql_query(listings_query, conn, params=params, parse_dates=["listed_at", "expiry_at"])
            claims = pd.read_sql_query(claims_query, conn, parse_dates=["claimed_at", "pickup_at"])
    else:
        listings = pd.read_sql_query(listings_query, source, params=params, parse_dates=["listed_at", "expiry_at"])
        claims = pd.read_sql_query(claims_query, source, parse_dates=["claimed_at", "pickup_at"])
        source.close()

    if provider_id:
        claims = claims[claims["listing_id"].isin(listings["listing_id"])]
    return listings, claims


def data_range(provider_id=None):
    listings, claims = load_frames(provider_id)
    if listings.empty and claims.empty and provider_id:
        listings, claims = load_frames()

    def latest_value(frame, column_name):
        if frame.empty or column_name not in frame.columns:
            return pd.NaT
        return frame[column_name].dropna().max()

    def earliest_value(frame, column_name):
        if frame.empty or column_name not in frame.columns:
            return pd.NaT
        return frame[column_name].dropna().min()

    candidates = [
        earliest_value(listings, "listed_at"),
        latest_value(listings, "expiry_at"),
        earliest_value(claims, "claimed_at"),
        latest_value(claims, "claimed_at"),
    ]
    valid_dates = [value for value in candidates if pd.notna(value)]

    if not valid_dates:
        today = pd.Timestamp.now().normalize()
        month_start = today.to_period("M").start_time
        month_end = today.to_period("M").end_time.normalize()
    else:
        minimum = min(valid_dates)
        maximum = max(valid_dates)
        month_start = minimum.to_period("M").start_time
        month_end = (maximum + pd.offsets.MonthEnd(0)).normalize()

    return {
        "min": month_start.strftime("%Y-%m-%d"),
        "max": month_end.strftime("%Y-%m-%d"),
        "start": month_start.strftime("%Y-%m-%d"),
        "end": month_end.strftime("%Y-%m-%d"),
    }


def filter_frames(listings, claims, start=None, end=None):
    if start:
        start_date = pd.to_datetime(start, errors="coerce")
        listings = listings[listings["listed_at"] >= start_date]
        claims = claims[claims["claimed_at"] >= start_date]
    if end:
        end_date = pd.to_datetime(end, errors="coerce") + pd.Timedelta(days=1)
        listings = listings[listings["listed_at"] < end_date]
        claims = claims[claims["claimed_at"] < end_date]
    return listings, claims


def build_insights(start=None, end=None, provider_id=None):
    listings, claims = load_frames(provider_id)
    listings, claims = filter_frames(listings, claims, start, end)
    total_listed = float(listings["quantity_kg"].sum())
    total_claimed = float(claims["claimed_kg"].sum())
    completed = claims[claims["status"].isin(["Completed", "Collected"])]
    completed_kg = float(completed["claimed_kg"].sum())
    diversion_rate = round((completed_kg / total_listed) * 100, 1) if total_listed else 0
    return {
        "total_listed": round(total_listed, 1),
        "total_claimed": round(total_claimed, 1),
        "completed_kg": round(completed_kg, 1),
        "diversion_rate": diversion_rate,
        "active_listings": int(listings["status"].isin(["Available", "Claimed"]).sum()),
        "providers": int(listings["provider"].nunique()),
        "receivers": int(claims["receiver"].nunique()),
    }


def chart_data(start=None, end=None, provider_id=None):
    listings, claims = load_frames(provider_id)
    listings, claims = filter_frames(listings, claims, start, end)
    category = listings.groupby("category", as_index=False)["quantity_kg"].sum().sort_values("quantity_kg", ascending=False)

    # Top Providers: If viewing as a provider, benchmark against top network providers
    if provider_id:
        benchmark_listings, _ = load_frames()
        benchmark_listings, _ = filter_frames(benchmark_listings, claims, start, end)
    else:
        benchmark_listings = listings

    current_provider_name = None
    if provider_id:
        p_match = benchmark_listings[benchmark_listings["provider_id"] == provider_id]
        if not p_match.empty:
            current_provider_name = p_match["provider"].iloc[0]

    top_providers_df = benchmark_listings.groupby("provider", as_index=False)["quantity_kg"].sum().sort_values("quantity_kg", ascending=False).head(10)
    
    # If the current provider is not in the top 10, include them so they can see their benchmark standing
    if current_provider_name and current_provider_name not in top_providers_df["provider"].values:
        curr_row = benchmark_listings[benchmark_listings["provider"] == current_provider_name].groupby("provider", as_index=False)["quantity_kg"].sum()
        if not curr_row.empty:
            top_providers_df = pd.concat([top_providers_df.iloc[:9], curr_row], ignore_index=True)

    top_names = top_providers_df["provider"].tolist()
    top_listings = benchmark_listings[benchmark_listings["provider"].isin(top_names)]

    categories = top_listings.groupby("category")["quantity_kg"].sum().sort_values(ascending=False).index.tolist()
    grouped = top_listings.groupby(["provider", "category"]).agg(
        kg=("quantity_kg", "sum"),
        items=("food_item", lambda s: ", ".join(sorted(set(s.dropna()))[:3]))
    ).reset_index()

    # Format display names with (Your Facility) for the active provider
    display_names = [f"{p} (Your Facility)" if (current_provider_name and p == current_provider_name) else p for p in top_names]

    provider_traces = []
    for cat in categories:
        vals = []
        items_list = []
        for p in top_names:
            row = grouped[(grouped["provider"] == p) & (grouped["category"] == cat)]
            if not row.empty:
                vals.append(round(float(row["kg"].iloc[0]), 1))
                items_list.append(str(row["items"].iloc[0]))
            else:
                vals.append(0.0)
                items_list.append("")
        provider_traces.append({
            "category": cat,
            "values": vals,
            "items": items_list,
        })

    provider_data = {
        "providers": display_names,
        "totals": [round(float(top_providers_df[top_providers_df["provider"] == p]["quantity_kg"].iloc[0]), 1) for p in top_names],
        "traces": provider_traces,
        "items": top_providers_df.to_dict("records"),
    }

    status = claims.groupby("status", as_index=False)["claimed_kg"].sum()
    status["status"] = pd.Categorical(status["status"], ["Pending", "Completed", "Collected", "Cancelled"], ordered=True)
    status = status.sort_values("status").dropna(subset=["status"])
    timeline = claims.assign(day=claims["claimed_at"].dt.normalize()).groupby("day", as_index=False)["claimed_kg"].sum().sort_values("day")
    timeline["day"] = timeline["day"].dt.strftime("%b %d")
    return {
        "category": category.to_dict("records"),
        "provider": provider_data,
        "status": status.to_dict("records"),
        "timeline": timeline.to_dict("records"),
    }

