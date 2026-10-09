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

        public CommentsController(AppDbContext context, ILogger<CommentsController> logger)
        {
            _context = context;
            _logger = logger;
        }

        // GET: api/posts/{postId}/comments
        [HttpGet("/api/posts/{postId}/comments")]
        public async Task<IActionResult> GetComments(int postId)
        {
            var postExists = await _context.Posts.AnyAsync(p => p.Id == postId);
            if (!postExists) return NotFound("Gönderi bulunamadı.");

            var comments = await _context.PostComments
                .Where(c => c.PostId == postId && c.ParentCommentId == null) // Sadece ana yorumlar
                .Include(c => c.User)
                .Include(c => c.Replies)
                    .ThenInclude(r => r.User) // Yanıtların sahipleri
                .OrderBy(c => c.CreatedAt) // Eskiden yeniye sıralama
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
                return BadRequest("Yorum boş olamaz.");

            // 1. Gönderi mevcut mu?
            var postExists = await _context.Posts.AnyAsync(p => p.Id == postId);
            if (!postExists) return NotFound("Gönderi bulunamadı.");

            // 2. Eğer parent id verilmişse, ana yorum kurallarını doğrula
            if (dto.ParentCommentId.HasValue)
            {
                var parentComment = await _context.PostComments.FirstOrDefaultAsync(c => c.Id == dto.ParentCommentId.Value);
                if (parentComment == null)
                    return BadRequest("Yanıt vermek istediğiniz ana yorum bulunamadı.");
                
                if (parentComment.PostId != postId)
                    return BadRequest("Ana yorum bu gönderiye ait değil.");
                
                if (parentComment.ParentCommentId != null)
                    return BadRequest("Yanıtın yanıtı oluşturulamaz (Tek seviyeli yanıt kısıtlaması).");
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
        public async Task<IActionResult> DeleteComment(int id)
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier);
            if (userIdClaim == null) return Unauthorized();
            var userId = int.Parse(userIdClaim.Value);

            var comment = await _context.PostComments.FirstOrDefaultAsync(c => c.Id == id);
            if (comment == null) return NotFound("Yorum bulunamadı.");

            if (comment.UserId != userId)
                return StatusCode(403, "Sadece kendi yorumunuzu silebilirsiniz."); // Forbidden

            // Cascade delete yapılandırıldığı için parent silindiğinde replies da silinecek.
            _context.PostComments.Remove(comment);
            await _context.SaveChangesAsync();

            return Ok();
        }
    }
}
