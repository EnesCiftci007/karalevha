using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Karalevha.API.Data;
using Karalevha.API.Models;
using Karalevha.API.DTOs;
using System.Security.Claims;
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
        public async Task<IActionResult> GetComments(int postId)
        {
            var postExists = await _context.Posts.AnyAsync(p => p.Id == postId);
            if (!postExists) return NotFound("GÃ¶nderi bulunamadÄ±.");

            var comments = await _context.PostComments
                .Where(c => c.PostId == postId && c.ParentCommentId == null) // Sadece ana yorumlar
                .Include(c => c.User)
                .Include(c => c.Replies)
                    .ThenInclude(r => r.User) // YanÄ±tlarÄ±n sahipleri
                .OrderBy(c => c.CreatedAt) // Eskiden yeniye sÄ±ralama
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
        public async Task<IActionResult> CreateComment(int postId, [FromBody] CreateCommentDto dto)
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier);
            if (userIdClaim == null) return Unauthorized();
            var userId = int.Parse(userIdClaim.Value);

            if (string.IsNullOrWhiteSpace(dto.Content))
                return BadRequest("Yorum boÅŸ olamaz.");

            // 1. Gonderi mevcut mu?
            var post = await _context.Posts.FirstOrDefaultAsync(p => p.Id == postId);
            if (post == null) return NotFound("Gonderi bulunamadi.");

            // 2. EÄŸer parent id verilmiÅŸse, ana yorum kurallarÄ±nÄ± doÄŸrula
            if (dto.ParentCommentId.HasValue)
            {
                var parentComment = await _context.PostComments.FirstOrDefaultAsync(c => c.Id == dto.ParentCommentId.Value);
                if (parentComment == null)
                    return BadRequest("YanÄ±t vermek istediÄŸiniz ana yorum bulunamadÄ±.");
                
                if (parentComment.PostId != postId)
                    return BadRequest("Ana yorum bu gÃ¶nderiye ait deÄŸil.");
                
                if (parentComment.ParentCommentId != null)
                    return BadRequest("YanÄ±tÄ±n yanÄ±tÄ± oluÅŸturulamaz (Tek seviyeli yanÄ±t kÄ±sÄ±tlamasÄ±).");
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

            if (dto.ParentCommentId.HasValue)
            {
                var parentComment = await _context.PostComments.FindAsync(dto.ParentCommentId.Value);
                if (parentComment != null)
                {
                    await _notificationService.SendNotificationAsync(parentComment.UserId, userId, "Reply", postId, comment.Id);
                }
            }
            else
            {
                await _notificationService.SendNotificationAsync(post.UserId, userId, "Comment", postId, comment.Id);
            }

            // Yorumu dÃ¶nmek iÃ§in user bilgisini dahil et
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
        public async Task<IActionResult> DeleteComment(int id)
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier);
            if (userIdClaim == null) return Unauthorized();
            var userId = int.Parse(userIdClaim.Value);

            var comment = await _context.PostComments.FirstOrDefaultAsync(c => c.Id == id);
            if (comment == null) return NotFound("Yorum bulunamadÄ±.");

            if (comment.UserId != userId)
                return StatusCode(403, "Sadece kendi yorumunuzu silebilirsiniz."); // Forbidden

            // Cascade delete yapÄ±landÄ±rÄ±ldÄ±ÄŸÄ± iÃ§in parent silindiÄŸinde replies da silinecek.
            _context.PostComments.Remove(comment);
            await _context.SaveChangesAsync();

            return Ok();
        }
    }
}






