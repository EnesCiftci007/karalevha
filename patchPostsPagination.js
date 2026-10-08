const fs = require('fs');
const file = 'Karalevha.API/Controllers/PostsController.cs';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
    'public async Task<IActionResult> GetPosts([FromQuery] int limit = 100)',
    'public async Task<IActionResult> GetPosts([FromQuery] int page = 1, [FromQuery] int pageSize = 10)'
);

// We need to order by descending first, then Skip and Take
content = content.replace(
    '.OrderByDescending(p => p.CreatedAt)\n                .Take(limit)',
    '.OrderByDescending(p => p.CreatedAt)\n                .Skip((page - 1) * pageSize)\n                .Take(pageSize)'
);

fs.writeFileSync(file, content);
