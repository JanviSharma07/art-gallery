from db import get_connection

artworks = [
    ("Monsoon Study", "R. Iyer", 4500.00, "https://picsum.photos/id/1015/600/400"),
    ("Blue Doorway", "M. Fernandes", 3200.00, "https://picsum.photos/id/1025/600/400"),
    ("Untitled No. 7", "A. Bose", 7800.00, "https://picsum.photos/id/1035/600/400"),
    ("Evening Terrace", "R. Iyer", 5100.00, "https://picsum.photos/id/1043/600/400"),
]

conn = get_connection()
cur = conn.cursor()

cur.executemany(
    "INSERT INTO artworks (title, artist, price, image_url) VALUES (%s, %s, %s, %s)",
    artworks
)

conn.commit()
cur.close()
conn.close()
print(f"Inserted {len(artworks)} artworks")