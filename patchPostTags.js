const fs = require('fs');
const file = 'Karalevha.API/Controllers/PostsController.cs';
let content = fs.readFileSync(file, 'utf8');

// Add tags to creation
content = content.replace(
  'Content = dto.Content,\n                UserId = userId,\n                CreatedAt = DateTime.UtcNow',
  'Content = dto.Content,\n                Tags = dto.Tags?.Where(t => !string.IsNullOrWhiteSpace(t)).Distinct().Take(3).ToList() ?? new List<string>(),\n                UserId = userId,\n                CreatedAt = DateTime.UtcNow'
);

// Add tags to return mapping
content = content.replace(
  'p.Likes,\n                    p.CreatedAt,',
  'p.Likes,\n                    p.Tags,\n                    p.CreatedAt,'
);

fs.writeFileSync(file, content);
