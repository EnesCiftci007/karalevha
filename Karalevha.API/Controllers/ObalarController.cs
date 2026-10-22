using Karalevha.API.Filters;
using BCrypt.Net;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Karalevha.API.Data;
using Karalevha.API.Models;
using Karalevha.API.DTOs;
using System.Security.Claims;
using Microsoft.AspNetCore.RateLimiting;
using Karalevha.API.Extensions;

namespace Karalevha.API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class ObalarController : ControllerBase
    {
        private readonly AppDbContext _context;

        public ObalarController(AppDbContext context)
        {
            _context = context;
        }

        // GET: api/obalar
        [HttpGet]
        public async Task<IActionResult> GetObalar([FromQuery] int skip = 0, [FromQuery] int take = 50)
        {
            skip = Math.Max(0, skip);
            take = Math.Clamp(take, 1, 100);

            // Token, kimlik doğrulama middleware'i tarafından imzasıyla birlikte doğrulanır;
            // geçersiz/eksik token durumunda kullanıcı anonim kabul edilir.
            var currentUserId = User.GetUserId() ?? -1;

            var obalar = await _context.Obalar
                .OrderByDescending(o => o.Id)
                .Skip(skip)
                .Take(take)
                .Select(o => new
                {
                    o.Id,
                    o.Name,
                    o.Description,
                    o.AvatarSeed,
                    o.Color,
                    o.MemberCount,
                    o.IsPrivate,
                    Owner = o.Owner != null ? o.Owner.Username : "Bilinmeyen",
                    IsMember = currentUserId != -1 && _context.ObaMembers.Any(m => m.ObaId == o.Id && m.UserId == currentUserId)
                })
                .ToListAsync();

            return Ok(obalar);
        }

        // GET: api/obalar/{id}
        [HttpGet("{id}")]
        public async Task<IActionResult> GetOba(int id)
        {
            var userId = User.GetUserId();

            var oba = await _context.Obalar
                .Where(o => o.Id == id)
                .Select(o => new
                {
                    o.Id,
                    o.Name,
                    o.Description,
                    o.AvatarSeed,
                    o.Color,
                    o.MemberCount,
                    o.IsPrivate,
                    o.OwnerId,
                    Owner = o.Owner != null ? o.Owner.Username : "Bilinmeyen",
                    IsMember = userId != null && _context.ObaMembers.Any(m => m.ObaId == o.Id && m.UserId == userId.Value),
                    CanManage = userId != null && o.OwnerId == userId.Value
                })
                .FirstOrDefaultAsync();

            if (oba == null) return NotFound(new { message = "Oba bulunamadı." });

            return Ok(oba);
        }

        // POST: api/obalar
        [HttpPost]
        [Authorize]
        [CheckBanned]
        public async Task<IActionResult> CreateOba(CreateObaDto dto)
        {
            var userId = User.GetRequiredUserId();

            if (dto.IsPrivate && string.IsNullOrWhiteSpace(dto.JoinPassword))
                return BadRequest(new { message = "Gizli bir oba için katılım şifresi belirlemelisiniz." });

            string seed = dto.Name.Replace(" ", "").ToLowerInvariant();

            using var transaction = await _context.Database.BeginTransactionAsync();

            try
            {
                var oba = new Oba
                {
                    Name = dto.Name.Trim(),
                    Description = string.IsNullOrWhiteSpace(dto.Description) ? null : dto.Description.Trim(),
                    Color = dto.Color,
                    AvatarSeed = seed,
                    OwnerId = userId, 
                    IsPrivate = dto.IsPrivate,
                    JoinPassword = dto.IsPrivate ? BCrypt.Net.BCrypt.EnhancedHashPassword(dto.JoinPassword) : null,
                    CreatedAt = DateTime.UtcNow
                };

                _context.Obalar.Add(oba);
                await _context.SaveChangesAsync(); // get Oba Id
                
                // Kurucuyu otomatik admin üye yap
                _context.ObaMembers.Add(new ObaMember {
                    ObaId = oba.Id,
                    UserId = userId,
                    Role = "admin"
                });

                var defaultChannels = new List<ObaChannel> {
                    new ObaChannel { Name = "genel", Type = "text", Category = "BİLGİ", ObaId = oba.Id },
                    new ObaChannel { Name = "kurallar", Type = "text", Category = "BİLGİ", ObaId = oba.Id },
                    new ObaChannel { Name = "sohbet", Type = "text", Category = "METİN KANALLARI", ObaId = oba.Id },
                    new ObaChannel { Name = "projeler", Type = "text", Category = "METİN KANALLARI", ObaId = oba.Id },
                    new ObaChannel { Name = "Genel Ses", Type = "voice", Category = "SES KANALLARI", ObaId = oba.Id }
                };
                
                _context.ObaChannels.AddRange(defaultChannels);
                await _context.SaveChangesAsync();
                
                await transaction.CommitAsync();

                var username = User.FindFirst(ClaimTypes.Name)?.Value ?? "Bilinmeyen";

                return CreatedAtAction(nameof(GetObalar), new { id = oba.Id }, new
                {
                    oba.Id,
                    oba.Name,
                    oba.Description,
                    oba.AvatarSeed,
                    oba.Color,
                    oba.MemberCount, 
                    oba.IsPrivate,
                    Owner = username
                });
            }
            catch
            {
                await transaction.RollbackAsync();
                return StatusCode(500, new { message = "Oba oluşturulurken bir hata oluştu." });
            }
        }

        // POST: api/obalar/{id}/join
        [HttpPost("{id}/join")] [Authorize] [CheckBanned] [EnableRateLimiting("AuthLimiter")]
        public async Task<IActionResult> JoinOba(int id, [FromBody] JoinObaDto dto)
        {
            var userId = User.GetRequiredUserId();

            var oba = await _context.Obalar.FindAsync(id);
            if (oba == null) return NotFound(new { message = "Oba bulunamadı." });

            var existingMember = await _context.ObaMembers.FirstOrDefaultAsync(m => m.ObaId == id && m.UserId == userId);
            if (existingMember != null) return Ok(new { success = true });

            if (oba.IsPrivate) {
                if (string.IsNullOrEmpty(oba.JoinPassword) || string.IsNullOrEmpty(dto.Password))
                    return BadRequest(new { message = "Yanlış şifre." });
                
                bool isValid = false;
                try {
                    isValid = BCrypt.Net.BCrypt.EnhancedVerify(dto.Password, oba.JoinPassword);
                } catch {
                    isValid = false;
                }
                
                if (!isValid) {
                    return BadRequest(new { message = "Yanlış şifre." });
                }
            }

            try 
            {
                var member = new ObaMember {
                    ObaId = id,
                    UserId = userId,
                    Role = "member"
                };
                _context.ObaMembers.Add(member);
                await _context.SaveChangesAsync();

                // Eşzamanlı katılımlarda sayaç kaybolmasın diye artış veritabanında atomik yapılır
                await _context.Obalar
                    .Where(o => o.Id == id)
                    .ExecuteUpdateAsync(s => s.SetProperty(o => o.MemberCount, o => o.MemberCount + 1));

                return Ok(new { success = true });
            }
            catch (DbUpdateException ex) when (ex.InnerException is Npgsql.PostgresException { SqlState: "23505" })
            {
                // Unique constraint hatası gelirse (aynı anda çift istek), zaten üye demektir.
                return Ok(new { success = true }); // eşzamanlı çift istek: kullanıcı zaten üye
            }
        }

        // DELETE: api/obalar/{id}
        [HttpDelete("{id}")]
        [Authorize]
        [CheckBanned]
        public async Task<IActionResult> DeleteOba(int id)
        {
            var userId = User.GetRequiredUserId();

            var oba = await _context.Obalar.FirstOrDefaultAsync(o => o.Id == id);
                
            if (oba == null) return NotFound(new { message = "Oba bulunamadı." });

            var currentUser = await _context.Users.FindAsync(userId);
            bool isPlatformOwner = currentUser != null && currentUser.Role == "Owner";
            if (oba.OwnerId != userId && !isPlatformOwner) {
                var member = await _context.ObaMembers.FirstOrDefaultAsync(m => m.ObaId == id && m.UserId == userId);
                if (member == null || member.Role != "admin") {
                    return StatusCode(StatusCodes.Status403Forbidden, new { message = "Bu obayı silme yetkiniz yok." });
                }
            }

            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                var channelIds = await _context.ObaChannels
                    .Where(c => c.ObaId == id)
                    .Select(c => c.Id)
                    .ToListAsync();

                if (channelIds.Count > 0)
                {
                    await _context.ObaMessages
                        .Where(m => channelIds.Contains(m.ChannelId))
                        .ExecuteDeleteAsync();
                }

                await _context.ObaChannels.Where(c => c.ObaId == id).ExecuteDeleteAsync();
                await _context.ObaMembers.Where(m => m.ObaId == id).ExecuteDeleteAsync();

                _context.Obalar.Remove(oba);
                await _context.SaveChangesAsync();
                
                await transaction.CommitAsync();
                return Ok(new { success = true });
            }
            catch
            {
                await transaction.RollbackAsync();
                return StatusCode(500, new { message = "Oba silinirken bir hata oluştu." });
            }
        }
    }
}



