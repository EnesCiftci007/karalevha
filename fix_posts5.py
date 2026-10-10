import re

with open('Karalevha.API/Controllers/PostsController.cs', 'r', encoding='utf-8') as f:
    text = f.read()

getpost_code = '''
        [HttpGet("{id}")]
        public async Task<IActionResult> GetPost(int id)
        {
            int? currentUserId = null;
            var currentUserIdClaim = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier);
            if (currentUserIdClaim != null)
            {
                currentUserId = int.Parse(currentUserIdClaim.Value);
            }

            var post = await _context.Posts
                .Include(p => p.User)
                .Where(p => p.Id == id)
                .Select(p => new
                {
                    p.Id,
                    p.Content,
                    Likes = p.PostLikes.Count,
                    CommentsCount = p.PostComments.Count,
                    IsLikedByCurrentUser = currentUserId != null && p.PostLikes.Any(pl => pl.UserId == currentUserId),
                    p.Tags, p.CreatedAt,
                    User = new
                    {
                        p.User!.Id,
                        p.User.Username,
                        p.User.AvatarSeed
                    }
                })
                .FirstOrDefaultAsync();

            if (post == null) return NotFound();
            return Ok(post);
        }

'''

text = text.replace('        // POST: api/posts\n        [HttpPost]', getpost_code + '        // POST: api/posts\n        [HttpPost]')

with open('Karalevha.API/Controllers/PostsController.cs', 'w', encoding='utf-8') as f:
    f.write(text)
