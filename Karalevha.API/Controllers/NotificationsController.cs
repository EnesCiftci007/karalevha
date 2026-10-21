using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Karalevha.API.Data;
using Karalevha.API.DTOs;
using Karalevha.API.Extensions;

namespace Karalevha.API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class NotificationsController : ControllerBase
    {
        private readonly AppDbContext _context;

        public NotificationsController(AppDbContext context)
        {
            _context = context;
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<NotificationDto>>> GetNotifications([FromQuery] int skip = 0, [FromQuery] int take = 50)
        {
            skip = Math.Max(0, skip);
            take = Math.Clamp(take, 1, 50);
            var currentUserId = User.GetUserId();
            if (currentUserId == null) return Unauthorized();
            var userId = currentUserId.Value;

            var notifications = await _context.Notifications
                .Where(n => n.RecipientUserId == userId)
                .OrderByDescending(n => n.CreatedAt)
                .Skip(skip)
                .Take(take)
                .Select(n => new NotificationDto
                {
                    Id = n.Id,
                    Type = n.Type,
                    PostId = n.PostId,
                    CommentId = n.CommentId,
                    IsRead = n.IsRead,
                    CreatedAt = n.CreatedAt,
                    Actor = new NotificationActorDto
                    {
                        Id = n.ActorUser!.Id,
                        Username = n.ActorUser.Username,
                        AvatarSeed = n.ActorUser.AvatarSeed
                    }
                })
                .ToListAsync();

            return Ok(notifications);
        }

        [HttpGet("unread-count")]
        public async Task<ActionResult<int>> GetUnreadCount()
        {
            var currentUserId = User.GetUserId();
            if (currentUserId == null) return Unauthorized();
            var userId = currentUserId.Value;

            var count = await _context.Notifications
                .Where(n => n.RecipientUserId == userId && !n.IsRead)
                .CountAsync();

            return Ok(count);
        }

        [HttpPatch("{id}/read")]
        public async Task<IActionResult> MarkAsRead(int id)
        {
            var currentUserId = User.GetUserId();
            if (currentUserId == null) return Unauthorized();
            var userId = currentUserId.Value;

            var notification = await _context.Notifications.FindAsync(id);
            if (notification == null) return NotFound();
            
            if (notification.RecipientUserId != userId) return Forbid();

            if (!notification.IsRead)
            {
                notification.IsRead = true;
                await _context.SaveChangesAsync();
            }

            return NoContent();
        }

        [HttpPatch("read-all")]
        public async Task<IActionResult> MarkAllAsRead()
        {
            var currentUserId = User.GetUserId();
            if (currentUserId == null) return Unauthorized();
            var userId = currentUserId.Value;

            await _context.Notifications
                .Where(n => n.RecipientUserId == userId && !n.IsRead)
                .ExecuteUpdateAsync(s => s.SetProperty(n => n.IsRead, true));

            return NoContent();
        }
    }
}

