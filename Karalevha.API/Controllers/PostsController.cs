using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Karalevha.API.Data;
using Karalevha.API.Models;
using Karalevha.API.DTOs;
using System.Security.Claims;

namespace Karalevha.API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class PostsController : ControllerBase
    {
        private readonly AppDbContext _context;

        public PostsController(AppDbContext context)
        {
            _context = context;
        }

        // GET: api/posts
        [HttpGet]
        public async Task<IActionResult> GetPosts([FromQuery] int page = 1, [FromQuery] int pageSize = 10)
        {
            var query = await _context.Posts
                .Include(p => p.User)
                .OrderByDescending(p => p.CreatedAt)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Select(p => new
                {
                    p.Id,
                    p.Content,
                    p.Likes,
                    p.Tags, p.CreatedAt,
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
        }

        // POST: api/posts
        [HttpPost]
        [Authorize] // Sadece giriş yapmış (Token'ı olan) kullanıcılar istek atabilir
        public async Task<IActionResult> CreatePost(CreatePostDto dto)
        {
            // Token'dan User ID'yi al
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier);
            if (userIdClaim == null) return Unauthorized();

            var userId = int.Parse(userIdClaim.Value);

            var post = new Post
            {
                Content = dto.Content, Tags = dto.Tags?.Where(t => !string.IsNullOrWhiteSpace(t)).Distinct().Take(3).ToList() ?? new List<string>(), UserId = userId, CreatedAt = DateTime.UtcNow
            };

            _context.Posts.Add(post);
            await _context.SaveChangesAsync();

            // Oluşturulan gönderiyi yazar bilgisiyle geri dön (ekrana hemen basmak için)
            var createdPost = await _context.Posts
                .Include(p => p.User)
                .Where(p => p.Id == post.Id)
                .Select(p => new
                {
                    p.Id,
                    p.Content,
                    p.Likes, p.Tags, p.CreatedAt, User = new
                    {
                        p.User.Id,
                        p.User.Username,
                        p.User.AvatarSeed
                    }
                })
                .FirstOrDefaultAsync();

            return CreatedAtAction(nameof(GetPosts), new { id = post.Id }, createdPost);
        }
    }
}


