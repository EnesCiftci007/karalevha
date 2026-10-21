using Karalevha.API.Filters;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Karalevha.API.Data;
using Karalevha.API.DTOs;
using Karalevha.API.Extensions;
using Karalevha.API.Models;

namespace Karalevha.API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class ObaChannelsController : ControllerBase
    {
        private readonly AppDbContext _context;

        public ObaChannelsController(AppDbContext context)
        {
            _context = context;
        }

        // GET: api/obachannels/{obaId}
        // Salt okunur: herkese açık obaların kanalları görüntülenebilir, üyelik POST api/obalar/{id}/join ile alınır.
        [HttpGet("{obaId}")]
        public async Task<IActionResult> GetChannels(int obaId)
        {
            var oba = await _context.Obalar.FindAsync(obaId);
            if (oba == null) return NotFound(new { message = "Oba bulunamadı." });

            if (oba.IsPrivate)
            {
                var userId = User.GetUserId();
                if (userId == null)
                    return Unauthorized();

                var isMember = await _context.ObaMembers.AnyAsync(m => m.ObaId == obaId && m.UserId == userId.Value);
                if (!isMember)
                    return StatusCode(StatusCodes.Status403Forbidden, new { message = "Bu gizli bir oba, katılmak için şifre girmelisiniz." });
            }

            var channels = await _context.ObaChannels
                .Where(c => c.ObaId == obaId)
                .OrderBy(c => c.CreatedAt)
                .Select(c => new { c.Id, c.Name, c.Type, c.Category, c.ObaId, c.CreatedAt })
                .ToListAsync();

            return Ok(channels);
        }

        // POST: api/obachannels/{obaId}
        [HttpPost("{obaId}")]
        [Authorize]
        [CheckBanned]
        public async Task<IActionResult> CreateChannel(int obaId, [FromBody] CreateChannelDto dto)
        {
            var userId = User.GetRequiredUserId();

            var oba = await _context.Obalar.FindAsync(obaId);
            if (oba == null) return NotFound(new { message = "Oba bulunamadı." });
            if (oba.OwnerId != userId)
                return StatusCode(StatusCodes.Status403Forbidden, new { message = "Sadece kurucu kanal oluşturabilir." });

            var name = dto.Name.Trim();
            if (dto.Type == "text")
                name = name.Replace(" ", "-").ToLowerInvariant();
            if (string.IsNullOrWhiteSpace(name))
                return BadRequest(new { message = "Kanal adı boş olamaz." });

            var category = string.IsNullOrWhiteSpace(dto.Category)
                ? (dto.Type == "voice" ? "SES KANALLARI" : "METİN KANALLARI")
                : dto.Category.Trim();

            var channel = new ObaChannel
            {
                Name = name,
                Type = dto.Type,
                Category = category,
                ObaId = obaId,
                CreatedAt = DateTime.UtcNow
            };

            _context.ObaChannels.Add(channel);
            await _context.SaveChangesAsync();

            return Ok(new { channel.Id, channel.Name, channel.Type, channel.Category, channel.ObaId, channel.CreatedAt });
        }
    }
}
