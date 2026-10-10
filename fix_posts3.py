import re

with open('Karalevha.API/Controllers/PostsController.cs', 'r', encoding='utf-8') as f:
    text = f.read()

# I will find all GetPost methods and remove them all, then append one.
text = re.sub(r'\[HttpGet\(\"\{id\}\"\)\].*?public async Task<IActionResult> GetPost\(int id\).*?return Ok\(post\);\s*}', '', text, flags=re.DOTALL)
text = re.sub(r'\[HttpGet\(\"\{id\}\"\)\].*?public async Task<IActionResult> GetPost\(int id\).*?return NotFound\(\);\s*return Ok\(post\);\s*}', '', text, flags=re.DOTALL)

with open('Karalevha.API/Controllers/PostsController.cs', 'w', encoding='utf-8') as f:
    f.write(text)
