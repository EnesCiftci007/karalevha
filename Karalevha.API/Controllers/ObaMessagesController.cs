using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.SignalR;
using Karalevha.API.Hubs;
using Karalevha.API.Data;
using Karalevha.API.Models;
using System.Security.Claims;

namespace Karalevha.API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class ObaMessagesController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly IHubContext<ChatHub> _hubContext;

        public ObaMessagesController(AppDbContext context, IHubContext<ChatHub> hubContext)
        {
            _context = context;
            _hubContext = hubContext;
        }

        // GET: api/obamessages/{channelId}
        [HttpGet("{channelId}")]
        public async Task<IActionResult> GetMessages(int channelId)
        {
            var messages = await _context.ObaMessages
                .Include(m => m.User)
                .Where(m => m.ChannelId == channelId)
                .OrderBy(m => m.CreatedAt)
                .Select(m => new {
                    m.Id,
                    m.Content,
                    m.CreatedAt,
                    User = new {
                        m.User!.Id,
                        m.User.Username
                    }
                })
                .ToListAsync();

            return Ok(messages);
        }

        public class CreateMessageDto {
            public string Content { get; set; } = string.Empty;
        }

        // POST: api/obamessages/{channelId}
        [HttpPost("{channelId}")]
        [Authorize]
        public async Task<IActionResult> SendMessage(int channelId, [FromBody] CreateMessageDto dto)
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier);
            if (userIdClaim == null) return Unauthorized();

            var userId = int.Parse(userIdClaim.Value);
            var channel = await _context.ObaChannels.FindAsync(channelId);
            if (channel == null) return NotFound("Kanal bulunamadı");

            
            // Slowmode Check (3 seconds)
            var lastMessage = await _context.ObaMessages
                .Where(m => m.UserId == userId && m.ChannelId == channelId)
                .OrderByDescending(m => m.CreatedAt)
                .FirstOrDefaultAsync();
                
            if (lastMessage != null && (DateTime.UtcNow - lastMessage.CreatedAt).TotalSeconds < 3)
            {
                return BadRequest(new { message = "Yavaş Mod Aktif: Lütfen ard arda mesaj göndermeden önce bekleyin." });
            }

            var username = User.FindFirst(ClaimTypes.Name)?.Value ?? "Bilinmeyen";

            var message = new ObaMessage
            {
                Content = dto.Content,
                ChannelId = channelId,
                UserId = userId,
                CreatedAt = DateTime.UtcNow
            };

            _context.ObaMessages.Add(message);
            await _context.SaveChangesAsync();

            var returnMessage = new {
                message.Id,
                message.Content,
                message.CreatedAt,
                User = new {
                    Id = userId,
                    Username = username
                }
            };

            // Fire and forget SignalR broadcast
            _ = _hubContext.Clients.Group(channelId.ToString()).SendAsync("ReceiveMessage", returnMessage);

            return Ok(returnMessage);
        }
    }
}
