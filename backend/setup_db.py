from db import get_connection

with open("schema.sql", "r") as f:
    sql = f.read()

conn = get_connection()
cur = conn.cursor()
cur.execute(sql)
conn.commit()
cur.close()
conn.close()
print("Tables created")
