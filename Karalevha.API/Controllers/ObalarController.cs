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
                .OrderByDescending(o => o.CreatedAt)
                .Select(o => new
                {
                    o.Id,
                    o.Name,
                    o.Description,
                    o.AvatarSeed,
                    o.Color,
                    o.MemberCount, o.IsPrivate,
                    Owner = o.Owner.Username
                })
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
                JoinPassword = dto.JoinPassword,
                CreatedAt = DateTime.UtcNow
            };

            _context.Obalar.Add(oba);
            await _context.SaveChangesAsync(); // get Oba Id

            var defaultChannel = new ObaChannel {
                Name = "genel",
                Type = "text",
                ObaId = oba.Id
            };
            _context.ObaChannels.Add(defaultChannel);
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
                if (string.IsNullOrEmpty(oba.JoinPassword) || oba.JoinPassword != dto.Password) {
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

            var oba = await _context.Obalar.FindAsync(id);
            if (oba == null) return NotFound("Oba bulunamadı");

            // Sadece owner veya admin silebilir
            var member = await _context.ObaMembers.FirstOrDefaultAsync(m => m.ObaId == id && m.UserId == userId);
            if (member == null || (member.Role != "owner" && member.Role != "admin")) {
                return Forbid("Bu obayı silme yetkiniz yok.");
            }

            _context.Obalar.Remove(oba);
            await _context.SaveChangesAsync();

            return Ok(new { success = true });
        }
    }
}
