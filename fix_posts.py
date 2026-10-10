import re

with open('Karalevha.API/Controllers/PostsController.cs', 'r', encoding='utf-8') as f:
    text = f.read()

text = re.sub(r'\[HttpGet\(\"\{id\}\"\)\].*?return Ok\(post\);\s*}', '', text, flags=re.DOTALL)

with open('Karalevha.API/Controllers/PostsController.cs', 'w', encoding='utf-8') as f:
    f.write(text)
