using Karalevha.API.Filters;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Karalevha.API.Data;
using Karalevha.API.Models;
using Karalevha.API.DTOs;
using Karalevha.API.Extensions;
using System.Linq;

namespace Karalevha.API.Controllers
{
    [ApiController]
    public class CommentsController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly ILogger<CommentsController> _logger;
        private readonly Karalevha.API.Services.INotificationService _notificationService;

        public CommentsController(AppDbContext context, ILogger<CommentsController> logger, Karalevha.API.Services.INotificationService notificationService)
        {
            _context = context;
            _logger = logger;
            _notificationService = notificationService;
        }

        // GET: api/posts/{postId}/comments
        [HttpGet("/api/posts/{postId}/comments")]
        public async Task<IActionResult> GetComments(int postId, [FromQuery] int skip = 0, [FromQuery] int take = 50)
        {
            skip = Math.Max(0, skip);
            take = Math.Clamp(take, 1, 100);

            var postExists = await _context.Posts.AnyAsync(p => p.Id == postId);
            if (!postExists) return NotFound(new { message = "Gönderi bulunamadı." });

            var comments = await _context.PostComments
                .Where(c => c.PostId == postId && c.ParentCommentId == null) // Sadece ana yorumlar
                .OrderBy(c => c.CreatedAt) // Eskiden yeniye sıralama
                .Skip(skip)
                .Take(take)
                .Select(c => new CommentDto
                {
                    Id = c.Id,
                    Content = c.Content,
                    CreatedAt = c.CreatedAt,
                    ParentCommentId = c.ParentCommentId,
                    User = new UserDto
                    {
                        Id = c.User!.Id,
                        Username = c.User.Username,
                        AvatarSeed = c.User.AvatarSeed
                    },
                    Replies = c.Replies.OrderBy(r => r.CreatedAt).Select(r => new CommentDto
                    {
                        Id = r.Id,
                        Content = r.Content,
                        CreatedAt = r.CreatedAt,
                        ParentCommentId = r.ParentCommentId,
                        User = new UserDto
                        {
                            Id = r.User!.Id,
                            Username = r.User.Username,
                            AvatarSeed = r.User.AvatarSeed
                        }
                    }).ToList()
                })
                .ToListAsync();

            return Ok(comments);
        }

        // POST: api/posts/{postId}/comments
        [HttpPost("/api/posts/{postId}/comments")]
        [Authorize]
        [CheckBanned]
        public async Task<IActionResult> CreateComment(int postId, [FromBody] CreateCommentDto dto)
        {
            var currentUserId = User.GetUserId();
            if (currentUserId == null) return Unauthorized();
            var userId = currentUserId.Value;

            if (string.IsNullOrWhiteSpace(dto.Content))
                return BadRequest(new { message = "Yorum boş olamaz." });

            // 1. Gönderi mevcut mu?
            var post = await _context.Posts.FirstOrDefaultAsync(p => p.Id == postId);
            if (post == null) return NotFound(new { message = "Gönderi bulunamadı." });

            // 2. Eğer parent id verilmişse, ana yorum kurallarını doğrula
            PostComment? parentComment = null;
            if (dto.ParentCommentId.HasValue)
            {
                parentComment = await _context.PostComments.FirstOrDefaultAsync(c => c.Id == dto.ParentCommentId.Value);
                if (parentComment == null)
                    return BadRequest(new { message = "Yanıt vermek istediğiniz ana yorum bulunamadı." });
                
                if (parentComment.PostId != postId)
                    return BadRequest(new { message = "Ana yorum bu gönderiye ait değil." });
                
                if (parentComment.ParentCommentId != null)
                    return BadRequest(new { message = "Yanıtın yanıtı oluşturulamaz (Tek seviyeli yanıt kısıtlaması)." });
            }

            var comment = new PostComment
            {
                PostId = postId,
                UserId = userId,
                Content = dto.Content.Trim(),
                ParentCommentId = dto.ParentCommentId,
                CreatedAt = DateTime.UtcNow
            };

            _context.PostComments.Add(comment);
            await _context.SaveChangesAsync();

            if (parentComment != null)
            {
                await _notificationService.SendNotificationAsync(parentComment.UserId, userId, "Reply", postId, comment.Id);
            }
            else
            {
                await _notificationService.SendNotificationAsync(post.UserId, userId, "Comment", postId, comment.Id);
            }

            // Yorumu dönmek için user bilgisini dahil et
            var user = await _context.Users.FindAsync(userId);
            var resultDto = new CommentDto
            {
                Id = comment.Id,
                Content = comment.Content,
                CreatedAt = comment.CreatedAt,
                ParentCommentId = comment.ParentCommentId,
                User = new UserDto
                {
                    Id = user!.Id,
                    Username = user.Username,
                    AvatarSeed = user.AvatarSeed
                }
            };

            return Created("", resultDto);
        }

        // DELETE: api/comments/{id}
        [HttpDelete("/api/comments/{id}")]
        [Authorize]
        [CheckBanned]
        public async Task<IActionResult> DeleteComment(int id)
        {
            var currentUserId = User.GetUserId();
            if (currentUserId == null) return Unauthorized();
            var userId = currentUserId.Value;

            var comment = await _context.PostComments.FirstOrDefaultAsync(c => c.Id == id);
            if (comment == null) return NotFound(new { message = "Yorum bulunamadı." });

            var currentUser = await _context.Users.FindAsync(userId);
            bool isOwnerOrAdmin = currentUser != null && (currentUser.Role == "Owner" || currentUser.Role == "Admin");
            if (comment.UserId != userId && !isOwnerOrAdmin)
                return StatusCode(StatusCodes.Status403Forbidden, new { message = "Sadece kendi yorumunuzu silebilirsiniz." });

            // Cascade delete yapılandırıldığı için parent silindiğinde replies da silinecek.
            _context.PostComments.Remove(comment);
            await _context.SaveChangesAsync();

            return Ok(new { message = "Yorum silindi." });
        }
    }
}
