using BCrypt.Net;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Karalevha.API.Data;
using Karalevha.API.Models;
using Karalevha.API.DTOs;
using System.Security.Claims;

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
        public async Task<IActionResult> GetObalar()
        {
            var obalar = await _context.Obalar
                .Select(o => new
                {
                    o.Id,
                    o.Name,
                    o.Description,
                    o.AvatarSeed,
                    o.Color,
                    o.MemberCount,
                    o.IsPrivate,
                    Owner = o.Owner != null ? o.Owner.Username : "Bilinmeyen"
                })
                .ToListAsync();

            var rnd = new Random();
            return Ok(obalar.OrderBy(x => rnd.Next()).ToList());
        }


        // GET: api/obalar/{id}/channels
        [HttpGet("{id}/channels")]
        [Authorize]
        public async Task<IActionResult> GetObaChannels(int id)
        {
            var channels = await _context.ObaChannels
                .Where(c => c.ObaId == id)
                .OrderBy(c => c.Id)
                .Select(c => new {
                    c.Id,
                    c.Name,
                    c.Type,
                    c.Category
                })
                .ToListAsync();

            return Ok(channels);
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
                JoinPassword = string.IsNullOrEmpty(dto.JoinPassword) ? null : BCrypt.Net.BCrypt.EnhancedHashPassword(dto.JoinPassword),
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
            await _context.SaveChangesAsync();


            var defaultChannels = new List<ObaChannel> {
                new ObaChannel { Name = "genel", Type = "text", Category = "BİLGİ", ObaId = oba.Id },
                new ObaChannel { Name = "kurallar", Type = "text", Category = "BİLGİ", ObaId = oba.Id },
                new ObaChannel { Name = "sohbet", Type = "text", Category = "METİN KANALLARI", ObaId = oba.Id },
                new ObaChannel { Name = "projeler", Type = "text", Category = "METİN KANALLARI", ObaId = oba.Id },
                new ObaChannel { Name = "Genel Ses", Type = "voice", Category = "SES KANALLARI", ObaId = oba.Id }
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
                if (string.IsNullOrEmpty(oba.JoinPassword)) return BadRequest("Yanlış şifre");
                
                bool isValid = false;
                try {
                    isValid = BCrypt.Net.BCrypt.EnhancedVerify(dto.Password, oba.JoinPassword);
                } catch {
                    // Fallback for old plaintext passwords
                    isValid = (oba.JoinPassword == dto.Password);
                }
                
                if (!isValid) {
                    return BadRequest("Yanlış şifre");
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
            
            var channels = await _context.ObaChannels.Where(c => c.ObaId == id).ToListAsync();
            foreach(var channel in channels) {
                var messages = await _context.ObaMessages.Where(m => m.ChannelId == channel.Id).ToListAsync();
                _context.ObaMessages.RemoveRange(messages);
            }
            _context.ObaChannels.RemoveRange(channels);

            _context.Obalar.Remove(oba);
            await _context.SaveChangesAsync();

            return Ok(new { success = true });
        }
    }
}
