from database import get_db

conn = get_db()
cursor = conn.cursor()
cursor.execute("ALTER TABLE forum_posts ADD COLUMN IF NOT EXISTS images TEXT DEFAULT '[]'")
cursor.execute("ALTER TABLE forum_posts ADD COLUMN IF NOT EXISTS repost_of_id INTEGER")
conn.commit()
print("Columns added successfully.")
