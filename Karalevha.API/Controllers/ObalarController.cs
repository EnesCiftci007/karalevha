using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Karalevha.API.Data;
using Karalevha.API.Models;
using Karalevha.API.DTOs;
using Karalevha.API.Services;
using Microsoft.AspNetCore.RateLimiting;
using System.Security.Claims;

namespace Karalevha.API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class ObalarController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly ObaFileStorage _storage;

        public ObalarController(AppDbContext context, ObaFileStorage storage)
        {
            _context = context;
            _storage = storage;
        }

        // GET: api/obalar
        [HttpGet]
        public async Task<IActionResult> GetObalar()
        {
            var me = CurrentUser.IdOf(User);
            // Son etkinliğe göre sıralı: en son yazışılan oba üstte. Gizli obalarda yalnızca zaman ve sayı
            // döner, mesaj içeriği değil.
            var obalar = await _context.Obalar
                .AsNoTracking()
                .Select(o => new
                {
                    o.Id,
                    o.Name,
                    o.Description,
                    o.AvatarSeed,
                    o.Color,
                    o.MemberCount,
                    o.IsPrivate,
                    o.CreatedAt,
                    Owner = o.Owner!.Username,
                    IsMember = me != null && (o.OwnerId == me || _context.ObaMembers.Any(m => m.ObaId == o.Id && m.UserId == me)),
                    MessageCount = _context.ObaMessages.Count(m => m.Channel!.ObaId == o.Id),
                    LastMessageAt = _context.ObaMessages.Where(m => m.Channel!.ObaId == o.Id).Max(m => (DateTime?)m.CreatedAt)
                })
                .OrderByDescending(o => o.LastMessageAt ?? o.CreatedAt)
                .ToListAsync();

            return Ok(obalar);
        }


        // POST: api/obalar
        [HttpPost]
        [Authorize]
        public async Task<IActionResult> CreateOba(CreateObaDto dto)
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier);
            if (userIdClaim == null) return Unauthorized();

            var userId = int.Parse(userIdClaim.Value);

            // İsme göre unique avatar seed oluştur
            string seed = dto.Name.Replace(" ", "").ToLower();

            var oba = new Oba
            {
                Name = dto.Name,
                Description = dto.Description,
                Color = dto.Color,
                AvatarSeed = seed,
                OwnerId = userId, IsPrivate = dto.IsPrivate,
                // Katılım şifresi düz metin değil, BCrypt özeti olarak saklanır
                JoinPassword = dto.IsPrivate && !string.IsNullOrWhiteSpace(dto.JoinPassword)
                    ? BCrypt.Net.BCrypt.HashPassword(dto.JoinPassword.Trim())
                    : null,
                CreatedAt = DateTime.UtcNow
            };

            _context.Obalar.Add(oba);
            await _context.SaveChangesAsync(); // get Oba Id

            var defaultChannels = new List<ObaChannel> {
                new ObaChannel { Name = "genel", Type = "text", Category = "BİLGİ", ObaId = oba.Id },
                new ObaChannel { Name = "kurallar", Type = "text", Category = "BİLGİ", ObaId = oba.Id },
                new ObaChannel { Name = "sohbet", Type = "text", Category = "METİN KANALLARI", ObaId = oba.Id },
                new ObaChannel { Name = "projeler", Type = "text", Category = "METİN KANALLARI", ObaId = oba.Id }
            };
            _context.ObaChannels.AddRange(defaultChannels);
            await _context.SaveChangesAsync();

            var username = User.FindFirst(ClaimTypes.Name)?.Value ?? "Bilinmeyen";

            return CreatedAtAction(nameof(GetObalar), new { id = oba.Id }, new
            {
                oba.Id,
                oba.Name,
                oba.Description,
                oba.AvatarSeed,
                oba.Color,
                oba.MemberCount, oba.IsPrivate,
                Owner = username
            });
        }

        public class JoinObaDto {
            public string? Password { get; set; }
        }

        // POST: api/obalar/{id}/join
        [HttpPost("{id}/join")]
        [Authorize]
        [EnableRateLimiting("JoinLimiter")] // şifre denemesini kişi başına dakikada 5 ile sınırla
        public async Task<IActionResult> JoinOba(int id, [FromBody] JoinObaDto dto)
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier);
            if (userIdClaim == null) return Unauthorized();
            var userId = int.Parse(userIdClaim.Value);

            var oba = await _context.Obalar.FindAsync(id);
            if (oba == null) return NotFound("Oba bulunamadı");

            var existingMember = await _context.ObaMembers.FirstOrDefaultAsync(m => m.ObaId == id && m.UserId == userId);
            if (existingMember != null) return Ok(new { success = true });

            if (oba.IsPrivate) {
                if (string.IsNullOrEmpty(oba.JoinPassword) || !CheckJoinPassword(oba, dto.Password?.Trim() ?? string.Empty)) {
                    return BadRequest(new { message = "Şifre yanlış." });
                }
            }

            var member = new ObaMember {
                ObaId = id,
                UserId = userId,
                Role = "member"
            };
            _context.ObaMembers.Add(member);

            oba.MemberCount += 1;

            await _context.SaveChangesAsync();
            return Ok(new { success = true });
        }

        /// <summary>
        /// Şifreyi doğrular. Bu sürümden önce kurulan obaların şifresi düz metin duruyordu;
        /// doğru girildiği ilk seferde BCrypt özetine çevrilir.
        /// </summary>
        private static bool CheckJoinPassword(Oba oba, string password)
        {
            var stored = oba.JoinPassword!;
            if (stored.StartsWith("$2"))
                return BCrypt.Net.BCrypt.Verify(password, stored);

            var ok = System.Security.Cryptography.CryptographicOperations.FixedTimeEquals(
                System.Text.Encoding.UTF8.GetBytes(stored), System.Text.Encoding.UTF8.GetBytes(password));
            if (ok) oba.JoinPassword = BCrypt.Net.BCrypt.HashPassword(password);
            return ok;
        }

        // POST: api/obalar/{id}/leave
        // Üye obadan ayrılır; gizli kanallardaki yeri de silinir. Kurucu ayrılamaz (obayı silebilir).
        [HttpPost("{id:int}/leave")]
        [Authorize]
        public async Task<IActionResult> LeaveOba(int id)
        {
            var userId = CurrentUser.IdOf(User)!.Value;
            var oba = await _context.Obalar.FindAsync(id);
            if (oba == null) return NotFound(new { message = "Oba bulunamadı." });
            if (oba.OwnerId == userId) return BadRequest(new { message = "Kurucu obadan ayrılamaz; obayı kapatmak için silebilirsin." });

            var removed = await _context.ObaMembers.Where(m => m.ObaId == id && m.UserId == userId).ExecuteDeleteAsync();
            if (removed > 0)
            {
                await _context.ObaChannelMembers.Where(m => m.UserId == userId && m.Channel!.ObaId == id).ExecuteDeleteAsync();
                await _context.Obalar.Where(o => o.Id == id && o.MemberCount > 1)
                    .ExecuteUpdateAsync(s => s.SetProperty(o => o.MemberCount, o => o.MemberCount - 1));
            }
            return Ok(new { success = true });
        }

        public class UpdateObaDto {
            public string Name { get; set; } = string.Empty;
            public string? Description { get; set; }
        }

        // PUT: api/obalar/{id}  (yalnızca kurucu)
        [HttpPut("{id:int}")]
        [Authorize]
        public async Task<IActionResult> UpdateOba(int id, UpdateObaDto dto)
        {
            var oba = await _context.Obalar.Include(o => o.Owner).FirstOrDefaultAsync(o => o.Id == id);
            if (oba == null) return NotFound(new { message = "Oba bulunamadı" });
            if (CurrentUser.IdOf(User) != oba.OwnerId) return StatusCode(403, new { message = "Obayı yalnızca kurucusu düzenleyebilir." });

            var name = dto.Name?.Trim() ?? string.Empty;
            if (name.Length == 0 || name.Length > 100) return BadRequest(new { message = "Oba adı 1-100 karakter olmalı." });
            var description = string.IsNullOrWhiteSpace(dto.Description) ? null : dto.Description.Trim();
            if (description?.Length > 500) return BadRequest(new { message = "Açıklama en fazla 500 karakter olabilir." });

            oba.Name = name;
            oba.Description = description;
            await _context.SaveChangesAsync();
            return Ok(new { oba.Id, oba.Name, oba.Description, oba.AvatarSeed, oba.Color, oba.MemberCount, oba.IsPrivate, Owner = oba.Owner!.Username });
        }

        // DELETE: api/obalar/{id}
        [HttpDelete("{id}")]
        [Authorize]
        public async Task<IActionResult> DeleteOba(int id)
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier);
            if (userIdClaim == null) return Unauthorized();
            var userId = int.Parse(userIdClaim.Value);

            var oba = await _context.Obalar
                .Include(o => o.Owner) // Include it if we need it
                .FirstOrDefaultAsync(o => o.Id == id);

            if (oba == null) return NotFound("Oba bulunamadı");

            // OwnerCheck based on OwnerId, fallback to ObaMembers for admins later
            if (oba.OwnerId != userId) {
                var member = await _context.ObaMembers.FirstOrDefaultAsync(m => m.ObaId == id && m.UserId == userId);
                if (member == null || member.Role != "admin") {
                    return StatusCode(403, "Bu obayı silme yetkiniz yok.");
                }
            }

            // Remove all related members and channels and messages manually if Cascade isn't working
            var members = await _context.ObaMembers.Where(m => m.ObaId == id).ToListAsync();
            _context.ObaMembers.RemoveRange(members);

            var storedFiles = new List<string>();
            var channels = await _context.ObaChannels.Where(c => c.ObaId == id).ToListAsync();
            foreach(var channel in channels) {
                var messages = await _context.ObaMessages.Where(m => m.ChannelId == channel.Id).ToListAsync();
                storedFiles.AddRange(messages.Where(m => m.FileStoredName != null).Select(m => m.FileStoredName!));
                _context.ObaMessages.RemoveRange(messages);
            }
            _context.ObaChannels.RemoveRange(channels);

            _context.Obalar.Remove(oba);
            await _context.SaveChangesAsync();

            // Kayıtlar silindikten sonra paylaşılan dosyaları da diskten temizle
            foreach (var stored in storedFiles) _storage.Delete(stored);

            return Ok(new { success = true });
        }
    }
}
