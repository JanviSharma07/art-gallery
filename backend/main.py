from fastapi import FastAPI
from pydantic import BaseModel, EmailStr
from psycopg2.extras import RealDictCursor
from db import get_connection

app = FastAPI()


# ---------- request models ----------

class RegisterRequest(BaseModel):
    name: str
    email: EmailStr


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
    conn = get_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)

    cur.execute("""
        INSERT INTO users (name, email)
        VALUES (%s, %s)
        ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
        RETURNING id, name, email
    """, (data.name, data.email))

    user = cur.fetchone()
    conn.commit()

    cur.close()
    conn.close()

    return user