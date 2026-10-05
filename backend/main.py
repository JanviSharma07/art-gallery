from fastapi import FastAPI, HTTPException, Depends
from pydantic import BaseModel, EmailStr
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from psycopg2.extras import RealDictCursor

from db import get_connection

from auth import (
    hash_password,
    verify_password,
    create_access_token,
    get_current_user
)

from fastapi.middleware.cors import CORSMiddleware
import psycopg2
import os

app = FastAPI()
security = HTTPBearer()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

import razorpay

razorpay_client = razorpay.Client(auth=(
    os.getenv("RAZORPAY_KEY_ID"),
    os.getenv("RAZORPAY_KEY_SECRET")
))
# ---------- request models ----------

class RegisterRequest(BaseModel):
    name: str | None = None
    username: str
    email: EmailStr
    password: str

class LoginRequest(BaseModel):
    login: str
    password: str

class OrderRequest(BaseModel):
    artwork_id: int

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str
# ---------- endpoints ----------

@app.get("/")
def home():
    return {"message": "Backend is running"}


@app.get("/artworks")
def get_artworks():
    release_stale_orders()
    conn = get_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)

    cur.execute("""
        SELECT id, title, artist, price, image_url, stock
        FROM artworks
        ORDER BY id
    """)
    rows = cur.fetchall()

    cur.close()
    conn.close()

    for row in rows:
        row["price"] = float(row["price"])

    return rows


@app.post("/register")
def register(data: RegisterRequest):

    if len(data.password) < 8:
        raise HTTPException(
            status_code=400,
            detail="Password must be at least 8 characters long"
        )

    username = data.username.strip()

    if not username:
        raise HTTPException(
            status_code=400,
            detail="Username is required"
        )

    conn = get_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)

    try:

        # Check whether username or email already exists
        cur.execute(
            """
            SELECT id
            FROM users
            WHERE email = %s OR username = %s
            """,
            (data.email, username)
        )

        existing_user = cur.fetchone()

        if existing_user:
            raise HTTPException(
                status_code=409,
                detail="Username or email already registered"
            )

        hashed_password = hash_password(data.password)

        cur.execute(
            """
            INSERT INTO users
                (name, username, email, password_hash)
            VALUES
                (%s, %s, %s, %s)
            RETURNING id, name, username, email
            """,
            (
                username,
                username,
                data.email,
                hashed_password
            )
        )

        user = cur.fetchone()

        conn.commit()

        token = create_access_token(
            user["id"],
            user["username"],
            user["email"]
        )

        return {
            "message": "Account created successfully",
            "user": user,
            "access_token": token,
            "token_type": "bearer"
        }

    except HTTPException:
        conn.rollback()
        raise

    except Exception:
        conn.rollback()

        raise HTTPException(
            status_code=500,
            detail="Could not create account"
        )

    finally:
        cur.close()
        conn.close()

@app.post("/login")
def login(data: LoginRequest):

    conn = get_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)

    try:
        cur.execute("""
            SELECT id, name, username, email, password_hash
            FROM users
            WHERE username = %s OR email = %s
        """, (data.login, data.login))

        user = cur.fetchone()

        if user is None or user["password_hash"] is None:
            raise HTTPException(
                status_code=401,
                detail="Invalid username/email or password"
            )

        if not verify_password(
            data.password,
            user["password_hash"]
        ):
            raise HTTPException(
                status_code=401,
                detail="Invalid username/email or password"
            )

        token = create_access_token(
            user["id"],
            user["username"],
            user["email"]
        )

        return {
            "message": "Login successful",
            "user": {
                "id": user["id"],
                "name": user["name"],
                "username": user["username"],
                "email": user["email"]
            },
            "access_token": token,
            "token_type": "bearer"
        }

    finally:
        cur.close()
        conn.close()

@app.get("/me")
def get_me(
    credentials: HTTPAuthorizationCredentials = Depends(HTTPBearer())
):
    return get_current_user(credentials)

@app.post("/login")
def login(data: LoginRequest):
    conn = get_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)

    cur.execute("""
        SELECT id, name, username, email, password_hash
        FROM users
        WHERE username = %s
    """, (data.username,))

    user = cur.fetchone()


    if user is None or user["password_hash"] is None:
        raise HTTPException(status_code=401, detail="Invalid username or password")

    if not verify_password(data.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid username or password")

    token = create_access_token(user["id"], user["username"], user["email"])

    return {
        "user": {
            "id": user["id"],
            "name": user["name"],
            "username": user["username"],
            "email": user["email"],
        },
        "access_token": token,
        "token_type": "bearer"
    }

@app.post("/orders")
def create_order(
    data: OrderRequest,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    user = get_current_user(credentials)

    conn = get_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)

    try:
        # claim the artwork — only succeeds if it is still available
        cur.execute("""
            UPDATE artworks
            SET stock = 0
            WHERE id = %s AND stock = 1
            RETURNING id, title, price
        """, (data.artwork_id,))

        artwork = cur.fetchone()

        if artwork is None:
            conn.rollback()
            raise HTTPException(status_code=409, detail="Sold out")

        amount_paise = int(float(artwork["price"]) * 100)

        # create the order in our database first
        cur.execute("""
            INSERT INTO orders (user_id, artwork_id, total, status)
            VALUES (%s, %s, %s, 'pending')
            RETURNING id, user_id, artwork_id, total, status
        """, (user["id"], data.artwork_id, artwork["price"]))

        order = cur.fetchone()

        # ask Razorpay to create a matching payment order
        rzp_order = razorpay_client.order.create({
            "amount": amount_paise,
            "currency": "INR",
            "receipt": f"order_{order['id']}",
            "payment_capture": 1
        })

        cur.execute(
            "UPDATE orders SET razorpay_order_id = %s WHERE id = %s",
            (rzp_order["id"], order["id"])
        )

        conn.commit()

        return {
            "order_id": order["id"],
            "amount": amount_paise,
            "currency": "INR",
            "razorpay_order_id": rzp_order["id"],
            "razorpay_key_id": os.getenv("RAZORPAY_KEY_ID"),
            "artwork_title": artwork["title"]
        }

    except HTTPException:
        raise
    except Exception:
        conn.rollback()
        raise HTTPException(status_code=500, detail="Could not create order")

    finally:
        cur.close()
        conn.close()

@app.get("/orders/{order_id}")
def get_order(order_id: int):
    conn = get_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)

    cur.execute("""
        SELECT o.id, o.status, o.total, a.title, a.image_url
        FROM orders o
        JOIN artworks a ON a.id = o.artwork_id
        WHERE o.id = %s
    """, (order_id,))

    order = cur.fetchone()

    cur.close()
    conn.close()

    if order is None:
        raise HTTPException(status_code=404, detail="Order not found")

    order["total"] = float(order["total"])
    return order

@app.get("/my-orders")
def my_orders(
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    user = get_current_user(credentials)

    conn = get_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)

    cur.execute("""
        SELECT o.id, o.status, o.total, o.created_at,
               a.title, a.artist, a.image_url
        FROM orders o
        JOIN artworks a ON a.id = o.artwork_id
        WHERE o.user_id = %s
        ORDER BY o.created_at DESC
    """, (user["id"],))

    orders = cur.fetchall()

    cur.close()
    conn.close()

    for order in orders:
        order["total"] = float(order["total"])

    return orders

@app.get("/admin/stats")
def admin_stats(key: str):
    if key != os.getenv("ADMIN_KEY"):
        raise HTTPException(status_code=403, detail="Not authorised")

    conn = get_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)

    cur.execute("SELECT COUNT(*) AS total FROM users")
    users_count = cur.fetchone()["total"]

    cur.execute("SELECT COUNT(*) AS total FROM orders WHERE status = 'paid'")
    sold_count = cur.fetchone()["total"]

    cur.execute("""
        SELECT COALESCE(SUM(total), 0) AS revenue
        FROM orders WHERE status = 'paid'
    """)
    revenue = float(cur.fetchone()["revenue"])

    cur.execute("""
        SELECT u.name, u.email, a.title, o.status, o.total
        FROM users u
        LEFT JOIN orders o   ON o.user_id = u.id
        LEFT JOIN artworks a ON a.id = o.artwork_id
        ORDER BY u.name
    """)
    rows = cur.fetchall()

    cur.close()
    conn.close()

    for row in rows:
        if row["total"] is not None:
            row["total"] = float(row["total"])

    return {
        "users_registered": users_count,
        "artworks_sold": sold_count,
        "revenue": revenue,
        "table": rows
    }

def release_stale_orders():
    """Free artworks whose orders were never paid within 10 minutes."""
    conn = get_connection()
    cur = conn.cursor()

    try:
        cur.execute("""
            UPDATE artworks
            SET stock = 1
            WHERE id IN (
                SELECT artwork_id FROM orders
                WHERE status = 'pending'
                  AND created_at < NOW() - INTERVAL '10 minutes'
            )
        """)

        cur.execute("""
            UPDATE orders
            SET status = 'expired'
            WHERE status = 'pending'
              AND created_at < NOW() - INTERVAL '10 minutes'
        """)

        conn.commit()

    finally:
        cur.close()
        conn.close()

@app.post("/change-password")
def change_password(
    data: ChangePasswordRequest,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    current_user = get_current_user(credentials)

    if len(data.new_password) < 8:
        raise HTTPException(
            status_code=400,
            detail="New password must be at least 8 characters long"
        )

    conn = get_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)

    try:
        cur.execute(
            "SELECT password_hash FROM users WHERE id = %s",
            (current_user["id"],)
        )

        user = cur.fetchone()

        if user is None or user["password_hash"] is None:
            raise HTTPException(status_code=404, detail="User not found")

        if not verify_password(data.current_password, user["password_hash"]):
            raise HTTPException(
                status_code=401,
                detail="Current password is incorrect"
            )

        cur.execute(
            "UPDATE users SET password_hash = %s WHERE id = %s",
            (hash_password(data.new_password), current_user["id"])
        )

        conn.commit()

        return {"message": "Password updated successfully"}

    except HTTPException:
        conn.rollback()
        raise

    except Exception:
        conn.rollback()
        raise HTTPException(status_code=500, detail="Could not update password")

    finally:
        cur.close()
        conn.close()

from fastapi import Request
import hmac
import hashlib


@app.post("/payment/webhook")
async def payment_webhook(request: Request):
    body = await request.body()
    signature = request.headers.get("X-Razorpay-Signature", "")
    secret = os.getenv("RAZORPAY_WEBHOOK_SECRET", "")

    expected = hmac.new(
        secret.encode(),
        body,
        hashlib.sha256
    ).hexdigest()

    if not hmac.compare_digest(expected, signature):
        raise HTTPException(status_code=400, detail="Invalid signature")

    import json
    payload = json.loads(body)

    event = payload.get("event")

    if event != "payment.captured":
        return {"status": "ignored"}

    payment = payload["payload"]["payment"]["entity"]
    rzp_order_id = payment.get("order_id")
    rzp_payment_id = payment.get("id")
    amount = payment.get("amount", 0) / 100

    conn = get_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)

    try:
        cur.execute("""
            UPDATE orders
            SET status = 'paid'
            WHERE razorpay_order_id = %s AND status = 'pending'
            RETURNING id
        """, (rzp_order_id,))

        order = cur.fetchone()

        if order:
            cur.execute("""
                INSERT INTO payments (order_id, razorpay_payment_id, amount, status)
                VALUES (%s, %s, %s, 'captured')
            """, (order["id"], rzp_payment_id, amount))

        conn.commit()
        return {"status": "ok"}

    except Exception:
        conn.rollback()
        raise HTTPException(status_code=500, detail="Webhook processing failed")

    finally:
        cur.close()
        conn.close()