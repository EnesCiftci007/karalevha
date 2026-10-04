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
        public async Task<IActionResult> GetPosts()
        {
            var posts = await _context.Posts
                .Include(p => p.User) // Kullanıcı bilgisini (isim, avatar) getir
                .OrderByDescending(p => p.CreatedAt) // En yeniler en üstte
                .Select(p => new
                {
                    p.Id,
                    p.Content,
                    p.Likes,
                    p.CreatedAt,
                    User = new
                    {
                        p.User.Id,
                        p.User.Username,
                        p.User.AvatarSeed
                    }
                })
                .ToListAsync();

            return Ok(posts);
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
                Content = dto.Content,
                UserId = userId,
                CreatedAt = DateTime.UtcNow
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
                    p.Likes,
                    p.CreatedAt,
                    User = new
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
