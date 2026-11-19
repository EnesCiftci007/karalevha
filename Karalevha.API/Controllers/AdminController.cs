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

        // ------------------------------------------------------------ Owner kurulumu ve devri

        /// <summary>Kurulum anahtarı: sunucu ortam değişkeni Bootstrap__OwnerToken (en az 32 karakter). Yoksa kurulum kapalı.</summary>
        private string? BootstrapToken(IConfiguration config) =>
            config["Bootstrap:OwnerToken"] is { Length: >= 32 } token ? token : null;

        private static bool SameSecret(string a, string b) =>
            System.Security.Cryptography.CryptographicOperations.FixedTimeEquals(
                System.Security.Cryptography.SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(a)),
                System.Security.Cryptography.SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(b)));

        private static bool IsUniqueViolation(DbUpdateException e) =>
            e.InnerException is Npgsql.PostgresException { SqlState: "23505" };

        // GET: api/admin/owner-durumu   — kulübün Owner'ı var mı, kurulum açık mı
        [HttpGet("owner-durumu")]
        public async Task<IActionResult> OwnerStatus([FromServices] IConfiguration config) =>
            Ok(new { hasOwner = await _context.Users.AnyAsync(u => u.Role == Roles.Owner), setupEnabled = BootstrapToken(config) != null });

        public class BootstrapOwnerDto
        {
            public string Token { get; set; } = string.Empty;
        }

        // POST: api/admin/owner-kurulum   — tek seferlik: Owner yokken, kurulum anahtarıyla, giriş yapmış kişiyi Owner yapar
        // Anahtar loglanmaz ve sabit zamanlı karşılaştırılır. Eşzamanlı iki istekten yalnızca biri geçer
        // (veritabanındaki tek-Owner kuralı); Owner oluştuktan sonra kurulum bir daha çalışmaz.
        [HttpPost("owner-kurulum")]
        [Microsoft.AspNetCore.RateLimiting.EnableRateLimiting("AuthLimiter")]
        public async Task<IActionResult> BootstrapOwner(BootstrapOwnerDto dto, [FromServices] IConfiguration config)
        {
            var token = BootstrapToken(config);
            if (token == null) return NotFound(new { message = "Owner kurulumu kapalı." });
            if (!SameSecret(dto.Token ?? string.Empty, token)) return StatusCode(403, new { message = "Kurulum anahtarı yanlış." });
            if (await _context.Users.AnyAsync(u => u.Role == Roles.Owner))
                return Conflict(new { message = "Kulübün zaten bir Owner'ı var; kurulum bir kez yapılır." });

            var me = await _context.Users.FindAsync(CurrentUser.IdOf(User));
            if (me == null) return Unauthorized();
            if (me.BannedUntil > DateTime.UtcNow) return StatusCode(403, new { message = "Askıdaki hesap Owner olamaz." });
            me.Role = Roles.Owner;
            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateException e) when (IsUniqueViolation(e))
            {
                return Conflict(new { message = "Kulübün zaten bir Owner'ı var; kurulum bir kez yapılır." });
            }
            _current.SetRole(me.Username, Roles.Owner);
            return Ok(new { userId = me.Id, role = me.Role });
        }

        public class TransferOwnerDto
        {
            public int UserId { get; set; }
            public string Password { get; set; } = string.Empty;
        }

        // POST: api/admin/owner-devret   — Owner kuruculuğu devreder; eski Owner aynı işlemde Admin olur
        [HttpPost("owner-devret")]
        [Microsoft.AspNetCore.RateLimiting.EnableRateLimiting("AuthLimiter")]
        public async Task<IActionResult> TransferOwner(TransferOwnerDto dto)
        {
            var me = await _context.Users.FindAsync(CurrentUser.IdOf(User));
            // Bellekteki role değil veritabanına bakılır: devir yalnızca gerçek Owner'dan
            if (me == null || me.Role != Roles.Owner) return StatusCode(403, new { message = "Kuruculuğu yalnızca Owner devredebilir." });
            if (!BCrypt.Net.BCrypt.EnhancedVerify(dto.Password ?? string.Empty, me.PasswordHash)) return BadRequest(new { message = "Şifre yanlış." });
            if (dto.UserId == me.Id) return BadRequest(new { message = "Zaten Owner'sın." });
            var target = await _context.Users.FindAsync(dto.UserId);
            if (target == null) return NotFound(new { message = "Kullanıcı bulunamadı." });
            if (target.BannedUntil > DateTime.UtcNow) return BadRequest(new { message = "Askıdaki hesaba kuruculuk devredilemez." });

            await using var tx = await _context.Database.BeginTransactionAsync();
            // Önce eski Owner düşer, sonra yenisi yükselir: tek-Owner kuralı ara adımda da bozulmaz
            me.Role = Roles.Admin;
            await _context.SaveChangesAsync();
            target.Role = Roles.Owner;
            _notifications.Add(target.Id, me.Id, $"{me.Username} kulübün kuruculuğunu (Owner) sana devretti.", $"/u/{target.Username}");
            try
            {
                await _context.SaveChangesAsync();
                await tx.CommitAsync();
            }
            catch (DbUpdateException e) when (IsUniqueViolation(e))
            {
                return Conflict(new { message = "Devir sırasında başka bir Owner değişikliği oldu; yeniden dene." });
            }
            _current.SetRole(me.Username, Roles.Admin);
            _current.SetRole(target.Username, Roles.Owner);
            return Ok(new { ownerId = target.Id, previousOwnerId = me.Id });
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
