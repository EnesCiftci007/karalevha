using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Karalevha.API.Data;
using Karalevha.API.Models;
using Karalevha.API.DTOs;
using System.Security.Claims;
using Npgsql;

namespace Karalevha.API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class PostsController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly ILogger<PostsController> _logger;

        public PostsController(AppDbContext context, ILogger<PostsController> logger)
        {
            _context = context;
            _logger = logger;
        }

        // GET: api/posts
        [HttpGet]
        public async Task<IActionResult> GetPosts([FromQuery] int page = 1, [FromQuery] int pageSize = 10) { page = Math.Max(1, page); pageSize = Math.Clamp(pageSize, 1, 50);
            
            int? currentUserId = null;
            var currentUserIdClaim = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier);
            if (currentUserIdClaim != null)
            {
                currentUserId = int.Parse(currentUserIdClaim.Value);
            }

            var query = await _context.Posts
                .Include(p => p.User)
                .OrderByDescending(p => p.CreatedAt)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
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
                .ToListAsync();

            if (currentUserId != null)
            {
                var currentUser = await _context.Users.FindAsync(currentUserId);
                
                if (currentUser != null && currentUser.Interests != null && currentUser.Interests.Any())
                {
                    var sorted = query.OrderByDescending(p => p.Tags != null && p.Tags.Any(t => currentUser.Interests.Contains(t))).ThenByDescending(p => p.CreatedAt).ThenBy(p => p.Id).ToList();
                    return Ok(sorted);
                }
            }

            var mixed = query.OrderByDescending(p => p.CreatedAt).ThenBy(p => p.Id).ToList();
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
                    Likes = p.PostLikes.Count, 
                    CommentsCount = 0,
                    IsLikedByCurrentUser = false, 
                    p.Tags, p.CreatedAt, User = new
                    {
                        p.User.Id,
                        p.User.Username,
                        p.User.AvatarSeed
                    }
                })
                .FirstOrDefaultAsync();

            return CreatedAtAction(nameof(GetPosts), new { id = post.Id }, createdPost);
        }

        // POST: api/posts/{id}/like
        [HttpPost("{id}/like")]
        [Authorize]
        public async Task<IActionResult> ToggleLike(int id)
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier);
            if (userIdClaim == null) return Unauthorized();
            var userId = int.Parse(userIdClaim.Value);
            
            var post = await _context.Posts.FirstOrDefaultAsync(p => p.Id == id);
            if (post == null) return NotFound("Gönderi bulunamadı.");

            var existingLike = await _context.PostLikes.FirstOrDefaultAsync(pl => pl.PostId == id && pl.UserId == userId);
            
            bool isLiked;
            if (existingLike != null)
            {
                _context.PostLikes.Remove(existingLike);
                isLiked = false;
            }
            else
            {
                var newLike = new PostLike { PostId = id, UserId = userId };
                try {
                    _context.PostLikes.Add(newLike);
                    await _context.SaveChangesAsync();
                    isLiked = true;
                }
                catch (DbUpdateException ex) {
                    if (ex.InnerException is PostgresException pgEx && pgEx.SqlState == "23505")
                    {
                        // Sadece bu entity'nin takibini kaldır
                        _context.Entry(newLike).State = EntityState.Detached;
                        
                        bool exists = await _context.PostLikes.AnyAsync(pl => pl.PostId == id && pl.UserId == userId);
                        if (exists)
                        {
                            isLiked = true;
                        }
                        else
                        {
                            _logger.LogError(ex, "ToggleLike unique constraint caught but record not found for PostId {PostId}, UserId {UserId}", id, userId);
                            return StatusCode(500, "Bir veritabanı hatası oluştu.");
                        }
                    }
                    else
                    {
                        _logger.LogError(ex, "ToggleLike DbUpdateException for PostId {PostId}, UserId {UserId}", id, userId);
                        return StatusCode(500, "Bir veritabanı hatası oluştu.");
                    }
                }
                catch (Exception ex) {
                    _logger.LogError(ex, "ToggleLike Exception for PostId {PostId}, UserId {UserId}", id, userId);
                    return StatusCode(500, "Beklenmeyen bir hata oluştu.");
                }
            }
            
            if (!isLiked) {
                 await _context.SaveChangesAsync();
            }

            var newLikeCount = await _context.PostLikes.CountAsync(pl => pl.PostId == id);
            return Ok(new { likes = newLikeCount, isLiked });
        }
    }
}

