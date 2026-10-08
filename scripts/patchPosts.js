const fs = require('fs');
const file = 'Karalevha.API/Controllers/PostsController.cs';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
    'public async Task<IActionResult> GetPosts()',
    'public async Task<IActionResult> GetPosts([FromQuery] int limit = 100)'
);

content = content.replace(
    '.OrderByDescending(p => p.CreatedAt)',
    '.OrderByDescending(p => p.CreatedAt)\n                .Take(limit)'
);

fs.writeFileSync(file, content);
