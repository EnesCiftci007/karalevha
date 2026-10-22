using Karalevha.API.Filters;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Karalevha.API.Data;
using Karalevha.API.Models;
using Karalevha.API.DTOs;
using Karalevha.API.Extensions;

namespace Karalevha.API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class AdminController : ControllerBase
    {
        private readonly AppDbContext _context;

        public AdminController(AppDbContext context)
        {
            _context = context;
        }

        // POST: api/admin/set-role (Yalnızca Owner çağırabilir)
        [HttpPost("set-role")]
        [Authorize] // Rol, JWT yerine veritabanından kontrol edilir (rol değişiklikleri anında geçerli olsun)
        [CheckBanned]
        public async Task<IActionResult> SetRole([FromBody] SetRoleDto dto)
        {
            var callerId = User.GetRequiredUserId();
            var caller = await _context.Users.FindAsync(callerId);
            if (caller == null || caller.Role != "Owner")
            {
                return StatusCode(StatusCodes.Status403Forbidden, new { message = "Yalnızca Owner bu işlemi yapabilir." });
            }
            var targetRole = dto.Role?.Trim();

            if (targetRole != "Admin" && targetRole != "User")
            {
                return BadRequest(new { message = "Geçersiz rol. Sadece 'Admin' veya 'User' atanabilir." });
            }

            if (dto.UserId == callerId)
            {
                return BadRequest(new { message = "Kendi rolünüzü bu endpoint üzerinden değiştiremezsiniz." });
            }

            var targetUser = await _context.Users.FindAsync(dto.UserId);
            if (targetUser == null)
            {
                return NotFound(new { message = "Kullanıcı bulunamadı." });
            }

            if (targetUser.Role == "Owner")
            {
                return BadRequest(new { message = "Owner rolündeki kullanıcının rolü değiştirilemez." });
            }

            targetUser.Role = targetRole;
            await _context.SaveChangesAsync();

            return Ok(new
            {
                message = $"Kullanıcının rolü başarıyla '{targetRole}' olarak güncellendi.",
                userId = targetUser.Id,
                role = targetUser.Role
            });
        }

        // POST: api/admin/ban-user (Owner veya Admin çağırabilir)
        [HttpPost("ban-user")]
        [Authorize]
        [CheckBanned]
        public async Task<IActionResult> BanUser([FromBody] BanUserDto dto)
        {
            var callerId = User.GetRequiredUserId();
            var caller = await _context.Users.FindAsync(callerId);
            if (caller == null || (caller.Role != "Owner" && caller.Role != "Admin"))
            {
                return StatusCode(StatusCodes.Status403Forbidden, new { message = "Bu işlemi yapma yetkiniz yok." });
            }
            var callerRole = caller.Role;

            if (dto.UserId == callerId)
            {
                return BadRequest(new { message = "Kendinizi engelleyemezsiniz." });
            }

            var durationMinutes = dto.DurationMinutes > 0
                ? dto.DurationMinutes
                : dto.DurationHours * 60;

            if (durationMinutes < 1 || durationMinutes > 43200) // Maksimum 30 gün (43200 dk)
            {
                return BadRequest(new { message = "Engelleme süresi 1 dakika ile 43200 dakika (30 gün) arasında olmalıdır." });
            }

            var targetUser = await _context.Users.FindAsync(dto.UserId);
            if (targetUser == null)
            {
                return NotFound(new { message = "Kullanıcı bulunamadı." });
            }

            if (targetUser.Role == "Owner")
            {
                return StatusCode(StatusCodes.Status403Forbidden, new { message = "Owner hesabı engellenemez." });
            }

            if (callerRole == "Admin" && targetUser.Role == "Admin")
            {
                return StatusCode(StatusCodes.Status403Forbidden, new { message = "Bir admin başka bir admini engelleyemez." });
            }

            targetUser.BannedUntil = DateTime.UtcNow.AddMinutes(durationMinutes);
            await _context.SaveChangesAsync();

            return Ok(new
            {
                message = $"Kullanıcı {targetUser.BannedUntil.Value:dd.MM.yyyy HH:mm} tarihine kadar başarıyla engellendi.",
                userId = targetUser.Id,
                bannedUntil = targetUser.BannedUntil
            });
        }

        // POST: api/admin/unban-user/{userId} (Owner veya Admin çağırabilir)
        [HttpPost("unban-user/{userId}")]
        [Authorize]
        [CheckBanned]
        public Task<IActionResult> UnbanUser(int userId) => UnbanUserInternal(userId);

        // POST: api/admin/unban-user (Body ile çağrım desteği)
        [HttpPost("unban-user")]
        [Authorize]
        [CheckBanned]
        public Task<IActionResult> UnbanUserByBody([FromBody] UnbanUserDto dto) => UnbanUserInternal(dto.UserId);

        private async Task<IActionResult> UnbanUserInternal(int userId)
        {
            var callerId = User.GetRequiredUserId();
            var caller = await _context.Users.FindAsync(callerId);
            if (caller == null || (caller.Role != "Owner" && caller.Role != "Admin"))
            {
                return StatusCode(StatusCodes.Status403Forbidden, new { message = "Bu işlemi yapma yetkiniz yok." });
            }
            var callerRole = caller.Role;

            var targetUser = await _context.Users.FindAsync(userId);
            if (targetUser == null)
            {
                return NotFound(new { message = "Kullanıcı bulunamadı." });
            }

            if (targetUser.Role == "Owner")
            {
                return StatusCode(StatusCodes.Status403Forbidden, new { message = "Owner hesabının engel durumu değiştirilemez." });
            }

            if (callerRole == "Admin" && targetUser.Role == "Admin")
            {
                return StatusCode(StatusCodes.Status403Forbidden, new { message = "Bir admin başka bir adminin engel durumunu değiştiremez." });
            }

            targetUser.BannedUntil = null;
            await _context.SaveChangesAsync();

            return Ok(new
            {
                message = "Kullanıcının engeli başarıyla kaldırıldı.",
                userId = targetUser.Id
            });
        }
    }
}
