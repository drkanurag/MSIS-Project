from datetime import datetime
from functools import wraps
import math
from flask import Flask, flash, redirect, render_template, request, session, url_for
from analysis import build_insights, chart_data, data_range
from db import get_db, init_db, get_db_type

app = Flask(__name__)
app.secret_key = "food-redistribution-demo"


def rows(query, params=()):
    connection = get_db()
    result = connection.execute(query, params).fetchall()
    connection.close()
    return result


@app.context_processor
def inject_globals():
    user = session.get("user") or {"role": "", "display_name": "Guest"}
    return {"current_year": datetime.now().year, "current_user": user, "db_engine": get_db_type()}


def login_required(view):
    @wraps(view)
    def wrapped(*args, **kwargs):
        if "user" not in session:
            return redirect(url_for("login", next=request.path))
        return view(*args, **kwargs)
    return wrapped


def roles_allowed(*roles):
    def decorator(view):
        @wraps(view)
        @login_required
        def wrapped(*args, **kwargs):
            if session["user"]["role"] not in roles:
                flash("Your account does not have access to that workspace.", "error")
                return redirect(url_for("dashboard"))
            return view(*args, **kwargs)
        return wrapped
    return decorator


@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        connection = get_db()
        user = connection.execute("SELECT user_id, username, role, display_name, provider_id, receiver_id FROM users WHERE username = ? AND password = ?", (request.form.get("username", "").strip(), request.form.get("password", ""))).fetchone()
        connection.close()
        if user:
            session["user"] = dict(user)
            return redirect(request.args.get("next") or url_for("dashboard"))
        flash("That login ID or password is not recognised.", "error")
    return render_template("login.html")


@app.route("/logout")
def logout():
    session.clear()
    return redirect(url_for("login"))


@app.route("/")
@login_required
def dashboard():
    provider_id = session["user"].get("provider_id") if session["user"]["role"] == "provider" else None
    selected_range = data_range(provider_id)
    start = request.args.get("start") or selected_range["start"]
    end = request.args.get("end") or selected_range["end"]
    insights = build_insights(start, end, provider_id)
    charts = chart_data(start, end, provider_id)
    recent_query = "SELECT fl.*, p.name AS provider FROM food_listings fl JOIN providers p ON p.provider_id = fl.provider_id WHERE date(fl.listed_at) BETWEEN ? AND ?"
    recent_params = [start, end]
    if provider_id:
        recent_query += " AND fl.provider_id = ?"
        recent_params.append(provider_id)
    recent = rows(recent_query + " ORDER BY fl.listed_at DESC LIMIT 6", recent_params)
    provider_name = rows("SELECT name FROM providers WHERE provider_id = ?", (provider_id,))[0]["name"] if provider_id else None
    return render_template("dashboard.html", insights=insights, charts=charts, recent=recent, provider_name=provider_name, date_range=selected_range, selected_start=start, selected_end=end, active_page="dashboard")


@app.route("/listings")
@login_required
def listings():
    status = request.args.get("status", "")
    dietary_type = request.args.get("dietary_type", "")
    food_search = request.args.get("food", "").strip()
    try:
        page = max(int(request.args.get("page", "1")), 1)
    except ValueError:
        page = 1
    page_size = 10

    query = """SELECT fl.*, p.name AS provider, p.location,
        fl.quantity_kg - COALESCE((SELECT SUM(c.claimed_kg) FROM claims c
        WHERE c.listing_id = fl.listing_id AND c.status IN ('Pending', 'Completed', 'Collected')), 0) AS remaining_kg
        FROM food_listings fl JOIN providers p ON p.provider_id = fl.provider_id"""
    params = []
    if session["user"]["role"] == "provider":
        query += " WHERE fl.provider_id = ?"
        params.append(session["user"]["provider_id"])
    if status in {"Available", "Claimed", "Completed", "Expired"}:
        query += " AND fl.status = ?" if params else " WHERE fl.status = ?"
        params.append(status)
    if dietary_type in {"Vegetarian", "Non-vegetarian"}:
        query += " AND fl.dietary_type = ?" if params else " WHERE fl.dietary_type = ?"
        params.append(dietary_type)
    if food_search:
        pattern = f"%{food_search}%"
        query += " AND (fl.food_item LIKE ? OR fl.food_name LIKE ? OR p.name LIKE ? OR fl.location LIKE ? OR fl.category LIKE ?)" if params else " WHERE (fl.food_item LIKE ? OR fl.food_name LIKE ? OR p.name LIKE ? OR fl.location LIKE ? OR fl.category LIKE ?)"
        params.extend((pattern, pattern, pattern, pattern, pattern))
    count_query = f"SELECT COUNT(*) AS total FROM ({query}) AS filtered_listings"
    total = rows(count_query, params)[0]["total"]
    total_pages = max(math.ceil(total / page_size), 1)
    page = min(page, total_pages)
    query += " ORDER BY fl.listed_at DESC LIMIT ? OFFSET ?"
    params.extend((page_size, (page - 1) * page_size))

    return render_template(
        "listings.html",
        listings=rows(query, params),
        selected_status=status,
        selected_dietary_type=dietary_type,
        food_search=food_search,
        page=page,
        total_pages=total_pages,
        total_listings=total,
        active_page="listings",
    )


@app.route("/listings/<int:listing_id>/claim", methods=["POST"])
@roles_allowed("ngo")
def claim_listing(listing_id):
    try:
        quantity = float(request.form["quantity_kg"])
        if quantity <= 0:
            raise ValueError
    except (KeyError, TypeError, ValueError):
        flash("Enter a valid quantity to claim.", "error")
        return redirect(url_for("listings"))

    connection = get_db()
    listing = connection.execute(
        """SELECT fl.quantity_kg, fl.status,
        fl.quantity_kg - COALESCE((SELECT SUM(c.claimed_kg) FROM claims c
        WHERE c.listing_id = fl.listing_id AND c.status IN ('Pending', 'Completed', 'Collected')), 0) AS remaining_kg
        FROM food_listings fl WHERE fl.listing_id = ?""",
        (listing_id,),
    ).fetchone()
    receiver_id = session["user"].get("receiver_id")
    if not listing or listing["status"] not in ("Available", "Claimed") or not receiver_id or quantity > listing["remaining_kg"]:
        connection.close()
        flash("That quantity is no longer available. Please choose a smaller amount.", "error")
        return redirect(url_for("listings"))
    connection.execute(
        "INSERT INTO claims(listing_id, receiver_id, claimed_kg, claimed_at, status) VALUES (?, ?, ?, ?, 'Pending')",
        (listing_id, receiver_id, quantity, datetime.now()),
    )
    connection.execute("UPDATE food_listings SET status = 'Claimed' WHERE listing_id = ?", (listing_id,))
    connection.commit()
    connection.close()
    flash("Food request submitted to the provider.", "success")
    return redirect(url_for("claims"))


@app.route("/listings/new", methods=["GET", "POST"])
@roles_allowed("provider")
def new_listing():
    providers = rows("SELECT provider_id, name, location FROM providers WHERE provider_id = ?", (session["user"]["provider_id"],))
    if request.method == "POST":
        form = request.form
        try:
            quantity = float(form["quantity_kg"])
            listed_at = datetime.fromisoformat(form["listed_at"])
            expiry_at = datetime.fromisoformat(form["expiry_at"])
            food_name = form["food_name"].strip()
            food_item = form["food_item"].strip()
            dietary_type = form["dietary_type"]
            if (quantity <= 0 or expiry_at <= listed_at or not food_name or not food_item
                    or dietary_type not in {"Vegetarian", "Non-vegetarian"}):
                raise ValueError
            connection = get_db()
            connection.execute(
                "INSERT INTO food_listings(provider_id, food_name, food_item, dietary_type, location, category, quantity_kg, listed_at, expiry_at, status, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Available', ?)",
                (session["user"]["provider_id"], food_name, food_item, dietary_type, form["location"], form["category"], quantity, listed_at, expiry_at, form.get("description", "")),
            )
            connection.commit()
            connection.close()
            flash("Surplus listing added to the live inventory.", "success")
            return redirect(url_for("listings"))
        except (KeyError, ValueError):
            flash("Check the required fields and make sure the expiry is after the listing time.", "error")
    return render_template("new_listing.html", providers=providers, active_page="listings")


@app.route("/claims")
@roles_allowed("admin", "ngo", "provider")
def claims():
    status = request.args.get("status", "").strip()
    search = request.args.get("q", "").strip()
    try:
        page = max(int(request.args.get("page", "1")), 1)
    except ValueError:
        page = 1
    page_size = 10

    query = """SELECT c.*, fl.food_name, fl.food_item, fl.dietary_type, fl.category, p.name AS provider, r.name AS receiver
        FROM claims c JOIN food_listings fl ON fl.listing_id = c.listing_id
        JOIN providers p ON p.provider_id = fl.provider_id JOIN receivers r ON r.receiver_id = c.receiver_id
        """
    params = []
    if session["user"]["role"] == "provider":
        query += " WHERE fl.provider_id = ?"
        params.append(session["user"]["provider_id"])
    if status in {"Pending", "Completed", "Collected", "Cancelled"}:
        query += " AND c.status = ?" if params else " WHERE c.status = ?"
        params.append(status)
    if search:
        pattern = f"%{search}%"
        query += " AND (fl.food_name LIKE ? OR fl.food_item LIKE ? OR p.name LIKE ? OR r.name LIKE ? OR printf('CL-%04d', c.claim_id) LIKE ? OR fl.category LIKE ?)" if params else " WHERE (fl.food_name LIKE ? OR fl.food_item LIKE ? OR p.name LIKE ? OR r.name LIKE ? OR printf('CL-%04d', c.claim_id) LIKE ? OR fl.category LIKE ?)"
        params.extend((pattern, pattern, pattern, pattern, pattern, pattern))

    count_query = f"SELECT COUNT(*) AS total FROM ({query}) AS filtered_claims"
    total = rows(count_query, params)[0]["total"]
    total_pages = max(math.ceil(total / page_size), 1)
    page = min(page, total_pages)

    query += " ORDER BY c.claimed_at DESC LIMIT ? OFFSET ?"
    params.extend((page_size, (page - 1) * page_size))
    claim_rows = rows(query, params)

    return render_template(
        "claims.html",
        claims=claim_rows,
        selected_status=status,
        search_query=search,
        page=page,
        total_pages=total_pages,
        total_claims=total,
        active_page="claims",
    )


@app.route("/claims/<int:claim_id>/status", methods=["POST"])
@roles_allowed("admin", "provider")
def update_claim_status(claim_id):
    new_status = request.form.get("status", "").strip()
    if new_status not in {"Collected", "Completed", "Cancelled"}:
        flash("Invalid status update requested.", "error")
        return redirect(url_for("claims"))

    connection = get_db()
    claim = connection.execute(
        """SELECT c.*, fl.provider_id FROM claims c
           JOIN food_listings fl ON fl.listing_id = c.listing_id
           WHERE c.claim_id = ?""",
        (claim_id,),
    ).fetchone()

    if not claim:
        connection.close()
        flash("Claim not found.", "error")
        return redirect(url_for("claims"))

    if session["user"]["role"] == "provider" and claim["provider_id"] != session["user"].get("provider_id"):
        connection.close()
        flash("You do not have permission to update this claim.", "error")
        return redirect(url_for("claims"))

    now = datetime.now()
    if new_status in {"Collected", "Completed"} and not claim["pickup_at"]:
        connection.execute(
            "UPDATE claims SET status = ?, pickup_at = ? WHERE claim_id = ?",
            (new_status, now, claim_id),
        )
    else:
        connection.execute(
            "UPDATE claims SET status = ? WHERE claim_id = ?",
            (new_status, claim_id),
        )

    # If cancelled, check if all remaining active claims on listing are zero, revert listing status if needed
    if new_status == "Cancelled":
        active_claims = connection.execute(
            "SELECT COUNT(*) FROM claims WHERE listing_id = ? AND status IN ('Pending', 'Completed', 'Collected')",
            (claim["listing_id"],),
        ).fetchone()[0]
        if active_claims == 0:
            connection.execute(
                "UPDATE food_listings SET status = 'Available' WHERE listing_id = ?",
                (claim["listing_id"],),
            )

    connection.commit()
    connection.close()
    flash(f"Claim #{claim_id:04d} updated to {new_status}.", "success")
    return redirect(url_for("claims"))


@app.route("/data")
@roles_allowed("admin")
def data_dictionary():
    connection = get_db()
    is_pg = getattr(connection, "is_postgres", False)
    tables = {}
    table_names = ["providers", "food_listings", "receivers", "claims", "users"]
    for t in table_names:
        if is_pg:
            query = """SELECT 
                c.column_name AS name,
                c.data_type AS type,
                CASE WHEN pk.column_name IS NOT NULL THEN 1 ELSE 0 END AS pk
            FROM information_schema.columns c
            LEFT JOIN (
                SELECT kcu.column_name
                FROM information_schema.table_constraints tc
                JOIN information_schema.key_column_usage kcu
                    ON tc.constraint_name = kcu.constraint_name
                    AND tc.table_schema = kcu.table_schema
                WHERE tc.constraint_type = 'PRIMARY KEY' AND tc.table_name = ?
            ) pk ON c.column_name = pk.column_name
            WHERE c.table_name = ?
            ORDER BY c.ordinal_position"""
            tables[t] = connection.execute(query, (t, t)).fetchall()
        else:
            tables[t] = connection.execute(f"PRAGMA table_info({t})").fetchall()
    connection.close()
    return render_template("data.html", tables=tables, active_page="data")


@app.route("/api/summary")
@login_required
def api_summary():
    provider_id = session["user"].get("provider_id") if session["user"]["role"] == "provider" else None
    selected_range = data_range(provider_id)
    start = request.args.get("start") or selected_range["start"]
    end = request.args.get("end") or selected_range["end"]
    return {"insights": build_insights(start, end, provider_id), "charts": chart_data(start, end, provider_id), "start": start, "end": end}


with app.app_context():
    init_db()
    print("\n" + "=" * 62)
    print("  ROOTED PLATFORM ONLINE")
    print(f"  Active Database Engine: {get_db_type()}")
    print("  PostgreSQL Server:      localhost:5432 / food_redistribution")
    print("  Status:                 Connected & Synchronized")
    print("=" * 62 + "\n")


if __name__ == "__main__":
    app.run(debug=True)
