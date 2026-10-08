const fs = require('fs');

let content = fs.readFileSync('Karalevha.API/Controllers/PostsController.cs', 'utf8');

const regex = /public async Task<IActionResult> GetPosts\(\)[\s\S]*?return Ok\(posts\);\s*\}/;

const newGetPosts = `public async Task<IActionResult> GetPosts()
        {
            var query = await _context.Posts
                .Include(p => p.User)
                .OrderByDescending(p => p.CreatedAt)
                .Select(p => new
                {
                    p.Id,
                    p.Content,
                    p.Likes,
                    p.CreatedAt,
                    p.Tags,
                    User = new
                    {
                        p.User!.Id,
                        p.User.Username,
                        p.User.AvatarSeed
                    }
                })
                .ToListAsync();

            var currentUserIdClaim = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier);
            if (currentUserIdClaim != null)
            {
                var currentUserId = int.Parse(currentUserIdClaim.Value);
                var currentUser = await _context.Users.FindAsync(currentUserId);
                
                if (currentUser != null && currentUser.Interests != null && currentUser.Interests.Any())
                {
                    var random = new Random();
                    var sorted = query
                        .OrderByDescending(p => p.Tags != null && p.Tags.Any(t => currentUser.Interests.Contains(t)))
                        .ThenBy(p => random.Next())
                        .ToList();
                    return Ok(sorted);
                }
            }

            var rnd = new Random();
            var mixed = query.OrderBy(p => rnd.Next()).ToList();
            return Ok(mixed);
        }`;

content = content.replace(regex, newGetPosts);
fs.writeFileSync('Karalevha.API/Controllers/PostsController.cs', content);
