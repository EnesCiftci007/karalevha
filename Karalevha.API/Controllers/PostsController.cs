using Karalevha.API.Filters;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Karalevha.API.Data;
using Karalevha.API.Models;
using Karalevha.API.DTOs;
using Karalevha.API.Extensions;
using Microsoft.AspNetCore.Authorization;
using Karalevha.API.Services;
using Npgsql;

namespace Karalevha.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class PostsController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly ILogger<PostsController> _logger;
        private readonly INotificationService _notificationService;

        public PostsController(AppDbContext context, ILogger<PostsController> logger, INotificationService notificationService)
        {
            _context = context;
            _logger = logger;
            _notificationService = notificationService;
        }

        // GET: api/posts
        [HttpGet]
        public async Task<IActionResult> GetPosts([FromQuery] int page = 1, [FromQuery] int pageSize = 10)
        {
            page = Math.Max(1, page);
            pageSize = Math.Clamp(pageSize, 1, 50);

            var currentUserId = User.GetUserId();

            var interests = new List<string>();
            if (currentUserId != null)
            {
                interests = await _context.Users
                    .Where(u => u.Id == currentUserId)
                    .Select(u => u.Interests)
                    .FirstOrDefaultAsync() ?? new List<string>();
            }

            // Kişiselleştirme sıralaması veritabanında yapılır, böylece sayfalar arasında tutarlı kalır.
            // İlgi alanıyla eşleşen gönderiler yalnızca son 7 gün içindeyse öne çıkarılır;
            // aksi halde eski eşleşmeler yeni gönderilerin önünde kalıcı olarak dururdu.
            var boostCutoff = DateTime.UtcNow.AddDays(-7);
            var hasInterests = interests.Count > 0;

            var query = await _context.Posts
                .OrderByDescending(p => hasInterests && p.CreatedAt >= boostCutoff && p.Tags.Any(t => interests.Contains(t)))
                .ThenByDescending(p => p.CreatedAt)
                .ThenByDescending(p => p.Id)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Select(p => new
                {
                    p.Id,
                    p.Content,
                    Likes = p.PostLikes.Count,
                    CommentsCount = p.PostComments.Count,
                    IsLikedByCurrentUser = currentUserId != null && p.PostLikes.Any(pl => pl.UserId == currentUserId),
                    p.Tags,
                    p.CreatedAt,
                    User = new
                    {
                        p.User!.Id,
                        p.User.Username,
                        p.User.AvatarSeed
                    }
                })
                .ToListAsync();

            return Ok(query);
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> GetPost(int id)
        {
            var currentUserId = User.GetUserId();

            var post = await _context.Posts
                .Where(p => p.Id == id)
                .Select(p => new
                {
                    p.Id,
                    p.Content,
                    Likes = p.PostLikes.Count,
                    CommentsCount = p.PostComments.Count,
                    IsLikedByCurrentUser = currentUserId != null && p.PostLikes.Any(pl => pl.UserId == currentUserId),
                    p.Tags,
                    p.CreatedAt,
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

        // POST: api/posts
        [HttpPost]
        [Authorize]
        [CheckBanned]
        public async Task<IActionResult> CreatePost(CreatePostDto dto)
        {
            var userId = User.GetRequiredUserId();
            var user = await _context.Users.FindAsync(userId);
            if (user == null) return Unauthorized();

            var post = new Post
            {
                Content = dto.Content,
                Tags = dto.Tags?.Where(t => !string.IsNullOrWhiteSpace(t)).Distinct().Take(3).ToList() ?? new List<string>(),
                UserId = userId,
                CreatedAt = DateTime.UtcNow
            };

            _context.Posts.Add(post);
            await _context.SaveChangesAsync();

            var createdPost = new
            {
                post.Id,
                post.Content,
                Likes = 0,
                CommentsCount = 0,
                IsLikedByCurrentUser = false,
                post.Tags,
                post.CreatedAt,
                User = new
                {
                    user.Id,
                    user.Username,
                    user.AvatarSeed
                }
            };

            return CreatedAtAction(nameof(GetPost), new { id = post.Id }, createdPost);
        }

        // POST: api/posts/{id}/like
        [HttpPost("{id}/like")]
        [Authorize]
        [CheckBanned]
        public async Task<IActionResult> ToggleLike(int id)
        {
            var userId = User.GetRequiredUserId();

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
                try
                {
                    _context.PostLikes.Add(newLike);
                    await _context.SaveChangesAsync();
                    isLiked = true;

                    await _notificationService.SendNotificationAsync(post.UserId, userId, "Like", id, null);
                }
                catch (DbUpdateException ex)
                {
                    if (ex.InnerException is PostgresException pgEx && pgEx.SqlState == "23505")
                    {
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
                catch (Exception ex)
                {
                    _logger.LogError(ex, "ToggleLike Exception for PostId {PostId}, UserId {UserId}", id, userId);
                    return StatusCode(500, "Beklenmeyen bir hata oluştu.");
                }
            }

            if (!isLiked)
            {
                await _context.SaveChangesAsync();
            }

            var newLikeCount = await _context.PostLikes.CountAsync(pl => pl.PostId == id);
            return Ok(new { likes = newLikeCount, isLiked });
        }

        // DELETE: api/posts/{id}
        [HttpDelete("{id}")]
        [Authorize]
        [CheckBanned]
        public async Task<IActionResult> DeletePost(int id)
        {
            var userId = User.GetRequiredUserId();

            var post = await _context.Posts.FirstOrDefaultAsync(p => p.Id == id);
            if (post == null) return NotFound("Gönderi bulunamadı.");

            var currentUser = await _context.Users.FindAsync(userId);
            bool isOwnerOrAdmin = currentUser != null && (currentUser.Role == "Owner" || currentUser.Role == "Admin");
            if (post.UserId != userId && !isOwnerOrAdmin)
            {
                return StatusCode(403, "Bu gönderiyi silme yetkiniz yok.");
            }

            _context.Posts.Remove(post);
            await _context.SaveChangesAsync();

            return Ok(new { message = "Gönderi başarıyla silindi." });
        }
    }
}
