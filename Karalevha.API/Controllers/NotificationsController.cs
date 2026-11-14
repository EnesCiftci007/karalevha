using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Karalevha.API.Data;
using Karalevha.API.Services;

namespace Karalevha.API.Controllers
{
    [Route("api/notifications")]
    [ApiController]
    [Authorize]
    [Karalevha.API.Filters.AllowWhileBanned] // askıdaki hesap da bildirimlerini okuyabilir
    public class NotificationsController : ControllerBase
    {
        private readonly AppDbContext _context;

        public NotificationsController(AppDbContext context)
        {
            _context = context;
        }

        // GET: api/notifications   — son 30 bildirim
        [HttpGet]
        public async Task<IActionResult> GetNotifications()
        {
            var userId = CurrentUser.IdOf(User);
            var list = await _context.Notifications.AsNoTracking()
                .Where(n => n.UserId == userId)
                .OrderByDescending(n => n.CreatedAt)
                .Take(30)
                .Select(n => new { n.Id, n.Text, n.Link, n.IsRead, n.CreatedAt, Actor = n.Actor != null ? n.Actor.Username : null })
                .ToListAsync();
            return Ok(list);
        }

        // GET: api/notifications/unread-count
        [HttpGet("unread-count")]
        public async Task<IActionResult> GetUnreadCount()
        {
            var userId = CurrentUser.IdOf(User);
            return Ok(new { count = await _context.Notifications.CountAsync(n => n.UserId == userId && !n.IsRead) });
        }

        // POST: api/notifications/read   — hepsini okundu say
        [HttpPost("read")]
        public async Task<IActionResult> MarkAllRead()
        {
            var userId = CurrentUser.IdOf(User);
            await _context.Notifications.Where(n => n.UserId == userId && !n.IsRead)
                .ExecuteUpdateAsync(s => s.SetProperty(n => n.IsRead, true));
            return Ok(new { success = true });
        }

        // POST: api/notifications/{id}/read
        [HttpPost("{id:int}/read")]
        public async Task<IActionResult> MarkRead(int id)
        {
            var userId = CurrentUser.IdOf(User);
            await _context.Notifications.Where(n => n.Id == id && n.UserId == userId)
                .ExecuteUpdateAsync(s => s.SetProperty(n => n.IsRead, true));
            return Ok(new { success = true });
        }
    }
}
