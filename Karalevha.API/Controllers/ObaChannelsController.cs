using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Karalevha.API.Data;
using Karalevha.API.Models;
using System.Security.Claims;

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
        [HttpGet("{obaId}")]
        public async Task<IActionResult> GetChannels(int obaId)
        {
            var channels = await _context.ObaChannels
                .Where(c => c.ObaId == obaId)
                .OrderBy(c => c.CreatedAt)
                .ToListAsync();

            return Ok(channels);
        }

        public class CreateChannelDto {
            public string Name { get; set; } = string.Empty;
            public string Type { get; set; } = "text";
        }

        // POST: api/obachannels/{obaId}
        [HttpPost("{obaId}")]
        [Authorize]
        public async Task<IActionResult> CreateChannel(int obaId, [FromBody] CreateChannelDto dto)
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier);
            if (userIdClaim == null) return Unauthorized();

            var userId = int.Parse(userIdClaim.Value);
            var oba = await _context.Obalar.FindAsync(obaId);
            
            if (oba == null) return NotFound("Oba bulunamadı");
            if (oba.OwnerId != userId) return Forbid("Sadece kurucu kanal oluşturabilir.");

            var channel = new ObaChannel
            {
                Name = dto.Name.Replace(" ", "-").ToLower(),
                Type = dto.Type,
                ObaId = obaId,
                CreatedAt = DateTime.UtcNow
            };

            _context.ObaChannels.Add(channel);
            await _context.SaveChangesAsync();

            return Ok(channel);
        }
    }
}
