using Karalevha.API.Filters;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.SignalR;
using Karalevha.API.Hubs;
using Karalevha.API.Data;
using Karalevha.API.DTOs;
using Karalevha.API.Extensions;
using Karalevha.API.Models;

namespace Karalevha.API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class ObaMessagesController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly IHubContext<ChatHub> _hubContext;
        private readonly ILogger<ObaMessagesController> _logger;

        public ObaMessagesController(AppDbContext context, IHubContext<ChatHub> hubContext, ILogger<ObaMessagesController> logger)
        {
            _context = context;
            _hubContext = hubContext;
            _logger = logger;
        }

        // GET: api/obamessages/{channelId}
        [HttpGet("{channelId}")]
        public async Task<IActionResult> GetMessages(int channelId, [FromQuery] int limit = 50, [FromQuery] int? beforeId = null)
        {
            limit = Math.Clamp(limit, 1, 100);

            var channel = await _context.ObaChannels.FindAsync(channelId);
            if (channel == null) return NotFound(new { message = "Kanal bulunamadı." });

            var oba = await _context.Obalar.FindAsync(channel.ObaId);
            if (oba == null) return NotFound(new { message = "Oba bulunamadı." });

            if (oba.IsPrivate)
            {
                var userId = User.GetUserId();
                if (userId == null)
                    return Unauthorized();

                var isMember = await _context.ObaMembers.AnyAsync(m => m.ObaId == oba.Id && m.UserId == userId.Value);
                if (!isMember)
                    return StatusCode(StatusCodes.Status403Forbidden, new { message = "Bu gizli obaya erişim yetkiniz yok." });
            }

            var query = _context.ObaMessages.Where(m => m.ChannelId == channelId);
            if (beforeId.HasValue)
            {
                query = query.Where(m => m.Id < beforeId.Value);
            }

            var messages = await query
                .OrderByDescending(m => m.CreatedAt)
                .ThenByDescending(m => m.Id)
                .Take(limit)
                .Select(m => new {
                    m.Id,
                    m.Content,
                    m.CreatedAt,
                    m.ChannelId,
                    User = new {
                        m.User!.Id,
                        m.User.Username
                    }
                })
                .ToListAsync();

            messages.Reverse(); // Kronolojik sırayla döndür
            return Ok(messages);
        }

        // POST: api/obamessages/{channelId}
        [HttpPost("{channelId}")]
        [Authorize]
        [CheckBanned]
        public async Task<IActionResult> SendMessage(int channelId, [FromBody] CreateMessageDto dto)
        {
            var userId = User.GetRequiredUserId();

            var content = dto.Content.Trim();
            if (string.IsNullOrEmpty(content))
                return BadRequest(new { message = "Mesaj boş olamaz." });

            var channel = await _context.ObaChannels.FindAsync(channelId);
            if (channel == null) return NotFound(new { message = "Kanal bulunamadı." });

            var isMember = await _context.ObaMembers.AnyAsync(m => m.ObaId == channel.ObaId && m.UserId == userId);
            if (!isMember)
                return StatusCode(StatusCodes.Status403Forbidden, new { message = "Bu kanala mesaj göndermek için Oba'ya katılmalısınız." });

            // Yavaş mod (1 saniye - spam bot koruması)
            var lastMessageAt = await _context.ObaMessages
                .Where(m => m.UserId == userId && m.ChannelId == channelId)
                .OrderByDescending(m => m.CreatedAt)
                .Select(m => (DateTime?)m.CreatedAt)
                .FirstOrDefaultAsync();

            if (lastMessageAt != null && (DateTime.UtcNow - lastMessageAt.Value).TotalSeconds < 1)
            {
                return BadRequest(new { message = "Yavaş Mod Aktif: Lütfen ard arda mesaj göndermeden önce bekleyin." });
            }

            var username = User.FindFirst(System.Security.Claims.ClaimTypes.Name)?.Value ?? "Bilinmeyen";

            var message = new ObaMessage
            {
                Content = content,
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
                message.ChannelId,
                User = new {
                    Id = userId,
                    Username = username
                }
            };

            try
            {
                await _hubContext.Clients.Group(channelId.ToString()).SendAsync("ReceiveMessage", returnMessage);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "SignalR yayını başarısız. ChannelId: {ChannelId}", channelId);
            }

            return Ok(returnMessage);
        }
    }
}
