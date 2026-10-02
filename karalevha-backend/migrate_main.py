import re

filepath = r'c:\Users\Enes\karalevha\karalevha-backend\main.py'

with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. "sqlite3.connect(DB_NAME); conn.row_factory = sqlite3.Row;" → "get_db();"
content = content.replace('sqlite3.connect(DB_NAME); conn.row_factory = sqlite3.Row;', 'get_db();')

# 2. Remaining "sqlite3.connect(DB_NAME)" → "get_db()"
content = content.replace('sqlite3.connect(DB_NAME)', 'get_db()')

# 3. Standalone "conn.row_factory = sqlite3.Row\n" lines → remove
content = re.sub(r'\s*conn\.row_factory = sqlite3\.Row\r?\n', '\n', content)

# 4. "sqlite3.IntegrityError" → "IntegrityError"
content = content.replace('sqlite3.IntegrityError', 'IntegrityError')

# 5. Update imports: remove "import sqlite3", add database imports
content = content.replace(
    'import sqlite3\n',
    'from database import get_db, IntegrityError\n'
)

# 6. Remove "DB_NAME = ..." line
content = re.sub(r'\nDB_NAME = "karalevha\.db"\n', '\n', content)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print("main.py updated successfully!")
print(f"Remaining 'sqlite3.connect': {content.count('sqlite3.connect')}")
print(f"Remaining 'sqlite3.Row': {content.count('sqlite3.Row')}")
print(f"Remaining 'sqlite3.IntegrityError': {content.count('sqlite3.IntegrityError')}")
print(f"'get_db()' count: {content.count('get_db()')}")
