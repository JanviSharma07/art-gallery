from db import get_connection

artworks = [
    ("The Hanging Gardens", "Elian Voss", 5.00,
     "https://res.cloudinary.com/zmh8quur/image/upload/f_auto,q_auto/9ee7ef9e-4436-4467-a113-420ad98ce285"),

    ("Garden at First Light", "Mira Laurent", 3.00,
     "https://images.unsplash.com/photo-1777749782051-178122d9cbbb?q=80&w=952&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D"),

    ("The Quiet Canopy", "Rowan Hale", 2.00,
     "https://images.pexels.com/photos/17190954/pexels-photo-17190954.jpeg"),

    ("Forest in Silver", "Clara Veyne", 4.00,
     "https://images.pexels.com/photos/30330364/pexels-photo-30330364.jpeg"),

    ("The Forest Has Eyes", "Aria Vale", 5.00,
     "https://res.cloudinary.com/zmh8quur/image/upload/f_auto,q_auto/4230f86e-320c-4b5c-958d-d658c710057d"),

    ("Glassflower Meadow", "Noa Arden", 4.00,
     "https://res.cloudinary.com/zmh8quur/image/upload/f_auto,q_auto/966dbad7-1fc4-490d-9e90-bbe128cf7040"),

    ("The White Forest", "Elise Maren", 3.00,
     "https://res.cloudinary.com/zmh8quur/image/upload/f_auto,q_auto/7dd053c4-add8-425a-a983-a8fa24b99575"),

    ("The Coral Cathedral", "Theo Laurent", 5.00,
     "https://res.cloudinary.com/zmh8quur/image/upload/f_auto,q_auto/58949121-67b0-40af-9c6a-a5a4d979eebb"),

    ("The Living Stone", "Adrian Sol", 2.00,
     "https://res.cloudinary.com/zmh8quur/image/upload/f_auto,q_auto/0bf6eeeb-22ae-4a70-8140-453689ea97df"),

    ("Orchard of Other Worlds", "Celeste Rowan", 4.00,
     "https://res.cloudinary.com/zmh8quur/image/upload/f_auto,q_auto/9935f163-674c-4675-9a4f-45ce4fb78eca"),
]

conn = get_connection()
cur = conn.cursor()

cur.execute("DELETE FROM payments")
cur.execute("DELETE FROM orders")
cur.execute("DELETE FROM artworks")
cur.execute("ALTER SEQUENCE artworks_id_seq RESTART WITH 1")

cur.executemany(
    "INSERT INTO artworks (title, artist, price, image_url) VALUES (%s, %s, %s, %s)",
    artworks
)

conn.commit()
cur.close()
conn.close()
print(f"Inserted {len(artworks)} artworks")