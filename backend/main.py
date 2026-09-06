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

import os

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------- request models ----------

class RegisterRequest(BaseModel):
    username: str
    email: EmailStr
    password: str

class LoginRequest(BaseModel):
    login: str
    password: str

class OrderRequest(BaseModel):
    user_id: int
    artwork_id: int
# ---------- endpoints ----------

@app.get("/")
def home():
    return {"message": "Backend is running"}


@app.get("/artworks")
def get_artworks():
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

        cur.execute(
            """
            SELECT id, name, username, email, password_hash
            FROM users
            WHERE email = %s OR username = %s
            """,
            (data.login, data.login)
        )

        user = cur.fetchone()

        if user is None:
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
        
@app.post("/orders")
def create_order(data: OrderRequest):
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

        # create the order using the price from the database
        cur.execute("""
            INSERT INTO orders (user_id, artwork_id, total, status)
            VALUES (%s, %s, %s, 'pending')
            RETURNING id, user_id, artwork_id, total, status
        """, (data.user_id, data.artwork_id, artwork["price"]))

        order = cur.fetchone()
        conn.commit()

        order["total"] = float(order["total"])
        return order

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
