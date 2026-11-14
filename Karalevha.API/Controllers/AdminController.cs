using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Karalevha.API.Data;
using Karalevha.API.Models;
using Karalevha.API.Services;

namespace Karalevha.API.Controllers
{
    /// <summary>
    /// Kulüp yönetimi. Owner rol dağıtır; Owner ve Admin hesapları süreli askıya alır.
    /// Owner hesabı askıya alınamaz, rolü değiştirilemez; Admin başka bir Admin'e dokunamaz.
    /// </summary>
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class AdminController : ControllerBase
    {
        private const int MaxBanMinutes = 30 * 24 * 60;

        private readonly AppDbContext _context;
        private readonly CurrentUser _current;
        private readonly NotificationService _notifications;

        public AdminController(AppDbContext context, CurrentUser current, NotificationService notifications)
        {
            _context = context;
            _current = current;
            _notifications = notifications;
        }

        public class SetRoleDto
        {
            public int UserId { get; set; }
            public string Role { get; set; } = string.Empty;
        }

        // POST: api/admin/set-role  (yalnızca Owner)
        [HttpPost("set-role")]
        public async Task<IActionResult> SetRole(SetRoleDto dto)
        {
            if (!_current.IsOwner(User)) return StatusCode(403, new { message = "Rolleri yalnızca Owner değiştirebilir." });
            if (dto.Role != Roles.Admin && dto.Role != Roles.User) return BadRequest(new { message = "Rol 'Admin' ya da 'User' olabilir." });
            if (dto.UserId == CurrentUser.IdOf(User)) return BadRequest(new { message = "Kendi rolünü değiştiremezsin." });

            var target = await _context.Users.FindAsync(dto.UserId);
            if (target == null) return NotFound(new { message = "Kullanıcı bulunamadı." });
            if (target.Role == Roles.Owner) return BadRequest(new { message = "Owner'ın rolü değiştirilemez." });

            target.Role = dto.Role;
            _notifications.Add(target.Id, CurrentUser.IdOf(User),
                dto.Role == Roles.Admin ? "Kulüp yöneticisi yapıldın." : "Kulüp yöneticiliğin kaldırıldı.", $"/u/{target.Username}");
            await _context.SaveChangesAsync();
            _current.SetRole(target.Username, target.Role);
            return Ok(new { userId = target.Id, role = target.Role });
        }

        public class BanUserDto
        {
            public int UserId { get; set; }
            public int DurationMinutes { get; set; }
            public int DurationHours { get; set; }
        }

        /// <summary>Hedefe dokunabilir mi? Hata varsa yanıtını döner.</summary>
        private IActionResult? CheckTarget(User target, string verb)
        {
            if (target.Id == CurrentUser.IdOf(User)) return BadRequest(new { message = $"Kendini {verb}." });
            if (target.Role == Roles.Owner) return StatusCode(403, new { message = "Owner hesabına dokunulamaz." });
            if (target.Role == Roles.Admin && !_current.IsOwner(User)) return StatusCode(403, new { message = "Bir yönetici başka bir yöneticiye dokunamaz." });
            return null;
        }

        // POST: api/admin/ban-user  (Owner ya da Admin)
        [HttpPost("ban-user")]
        public async Task<IActionResult> BanUser(BanUserDto dto)
        {
            if (!_current.IsAdmin(User)) return StatusCode(403, new { message = "Bu işlem kulüp yöneticilerine açık." });

            var minutes = dto.DurationMinutes > 0 ? dto.DurationMinutes : dto.DurationHours * 60;
            if (minutes < 1 || minutes > MaxBanMinutes) return BadRequest(new { message = "Süre 1 dakika ile 30 gün arasında olmalı." });

            var target = await _context.Users.FindAsync(dto.UserId);
            if (target == null) return NotFound(new { message = "Kullanıcı bulunamadı." });
            if (CheckTarget(target, "askıya alamazsın") is { } error) return error;

            target.BannedUntil = DateTime.UtcNow.AddMinutes(minutes);
            await _context.SaveChangesAsync();
            return Ok(new { userId = target.Id, bannedUntil = target.BannedUntil });
        }

        // POST: api/admin/unban-user/{userId}  (Owner ya da Admin)
        [HttpPost("unban-user/{userId:int}")]
        public async Task<IActionResult> UnbanUser(int userId)
        {
            if (!_current.IsAdmin(User)) return StatusCode(403, new { message = "Bu işlem kulüp yöneticilerine açık." });

            var target = await _context.Users.FindAsync(userId);
            if (target == null) return NotFound(new { message = "Kullanıcı bulunamadı." });
            if (CheckTarget(target, "askıdan çıkaramazsın") is { } error) return error;

            target.BannedUntil = null;
            await _context.SaveChangesAsync();
            return Ok(new { userId = target.Id });
        }
    }
}
