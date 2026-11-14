using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.SignalR;
using Karalevha.API.Hubs;
using Karalevha.API.Data;
using Karalevha.API.Models;
using Karalevha.API.Services;
using System.Security.Claims;

namespace Karalevha.API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class ObaMessagesController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly IHubContext<ChatHub> _hubContext;
        private readonly ObaFileStorage _storage;
        private readonly CurrentUser _current;
        private readonly NotificationService _notifications;
        private readonly ObaAccess _access;

        public ObaMessagesController(AppDbContext context, IHubContext<ChatHub> hubContext, ObaFileStorage storage, CurrentUser current, NotificationService notifications, ObaAccess access)
        {
            _context = context;
            _hubContext = hubContext;
            _storage = storage;
            _current = current;
            _notifications = notifications;
            _access = access;
        }

        /// <summary>Mesajda @adı geçen ve kanalı okuyabilen kişilere bildirim ekler (SaveChanges çağıranda).</summary>
        private async Task NotifyMentions(ObaChannel channel, string content, int authorId)
        {
            if (string.IsNullOrEmpty(content) || !content.Contains('@')) return;
            var ids = await SocialController.MentionedUserIds(_context, content);
            if (ids.Count == 0) return;
            var oba = channel.Oba!;
            if (channel.IsPrivate)
            {
                var readers = await _access.PrivateChannelReadersAsync(channel);
                ids = ids.Where(readers.Contains).ToList();
            }
            else if (oba.IsPrivate)
            {
                var members = await _context.ObaMembers.Where(m => m.ObaId == oba.Id).Select(m => m.UserId).ToListAsync();
                ids = ids.Where(id => id == oba.OwnerId || members.Contains(id)).ToList();
            }
            var author = CurrentUser.NameOf(User);
            foreach (var id in ids)
                _notifications.Add(id, authorId, $"{author}, {oba.Name} obasında #{channel.Name} kanalında senden bahsetti.", $"/e-oba/{oba.Id}");
        }

        // DELETE: api/obamessages/message/{messageId}
        // Mesajı yazan, obanın kurucusu ya da kulüp yöneticisi silebilir.
        [HttpDelete("message/{messageId:int}")]
        [Authorize]
        public async Task<IActionResult> DeleteMessage(int messageId)
        {
            var message = await _context.ObaMessages
                .Include(m => m.Channel!).ThenInclude(c => c.Oba)
                .FirstOrDefaultAsync(m => m.Id == messageId);
            if (message == null) return NotFound(new { message = "Mesaj bulunamadı." });

            var userId = CurrentUser.IdOf(User);
            var allowed = userId == message.UserId || userId == message.Channel?.Oba?.OwnerId || _current.IsAdmin(User);
            if (!allowed) return StatusCode(403, new { message = "Bu mesajı silemezsin." });

            var stored = message.FileStoredName;
            var channelId = message.ChannelId;
            _context.ObaMessages.Remove(message);
            await _context.SaveChangesAsync();
            _storage.Delete(stored);

            _ = _hubContext.Clients.Group(channelId.ToString()).SendAsync("MessageDeleted", messageId);
            return Ok(new { success = true });
        }

        private int? CurrentUserId =>
            int.TryParse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value, out var id) ? id : null;

        private record ChannelAccess(ObaChannel? Channel, bool CanRead, bool CanWrite);

        /// <summary>Kurallar ObaAccess içinde: açık/gizli oba ve gizli kanal.</summary>
        private async Task<ChannelAccess> ResolveAccess(int channelId)
        {
            var channel = await _context.ObaChannels
                .Include(c => c.Oba)
                .FirstOrDefaultAsync(c => c.Id == channelId);
            if (channel?.Oba == null) return new ChannelAccess(null, false, false);

            var (canRead, canWrite) = await _access.ChannelAsync(channel, CurrentUserId);
            return new ChannelAccess(channel, canRead, canWrite);
        }

        private static object ToDto(ObaMessage m, int userId, string username) => new
        {
            m.Id,
            m.Content,
            m.CreatedAt,
            User = new { Id = userId, Username = username },
            File = m.FileStoredName == null ? null : new
            {
                Name = m.FileName,
                Size = m.FileSize,
                ContentType = m.FileContentType
            }
        };

        // GET: api/obamessages/{channelId}
        [HttpGet("{channelId:int}")]
        public async Task<IActionResult> GetMessages(int channelId)
        {
            var access = await ResolveAccess(channelId);
            if (access.Channel == null) return NotFound(new { message = "Kanal bulunamadı" });
            if (!access.CanRead) return CurrentUserId == null ? Unauthorized() : StatusCode(403);

            var messages = await _context.ObaMessages
                .AsNoTracking()
                .Include(m => m.User)
                .Where(m => m.ChannelId == channelId)
                .OrderBy(m => m.CreatedAt)
                .ToListAsync();

            return Ok(messages.Select(m => ToDto(m, m.UserId, m.User?.Username ?? "Bilinmeyen")));
        }

        public class CreateMessageDto {
            public string Content { get; set; } = string.Empty;
        }

        // POST: api/obamessages/{channelId}
        [HttpPost("{channelId:int}")]
        [Authorize]
        public async Task<IActionResult> SendMessage(int channelId, [FromBody] CreateMessageDto dto)
        {
            var userId = CurrentUserId;
            if (userId == null) return Unauthorized();

            var access = await ResolveAccess(channelId);
            if (access.Channel == null) return NotFound(new { message = "Kanal bulunamadı" });
            if (!access.CanWrite) return StatusCode(403, new { message = "Bu obaya mesaj gönderme yetkiniz yok." });

            var content = dto.Content?.Trim() ?? string.Empty;
            if (content.Length == 0) return BadRequest(new { message = "Mesaj boş olamaz." });
            if (content.Length > 2000) return BadRequest(new { message = "Mesaj en fazla 2000 karakter olabilir." });

            // Slowmode Check (3 seconds)
            var lastMessage = await _context.ObaMessages
                .Where(m => m.UserId == userId && m.ChannelId == channelId)
                .OrderByDescending(m => m.CreatedAt)
                .FirstOrDefaultAsync();

            if (lastMessage != null && (DateTime.UtcNow - lastMessage.CreatedAt).TotalSeconds < 3)
            {
                return BadRequest(new { message = "Yavaş Mod Aktif: Lütfen ard arda mesaj göndermeden önce bekleyin." });
            }

            var message = new ObaMessage
            {
                Content = content,
                ChannelId = channelId,
                UserId = userId.Value,
                CreatedAt = DateTime.UtcNow
            };

            _context.ObaMessages.Add(message);
            await NotifyMentions(access.Channel, content, userId.Value);
            await _context.SaveChangesAsync();

            return Ok(Broadcast(message, userId.Value));
        }

        // POST: api/obamessages/{channelId}/file  (multipart: file + opsiyonel content)
        [HttpPost("{channelId:int}/file")]
        [Authorize]
        [EnableRateLimiting("ChatFileLimiter")]
        [RequestSizeLimit(ObaFileStorage.MaxFileSize + 1024 * 1024)]
        [RequestFormLimits(MultipartBodyLengthLimit = ObaFileStorage.MaxFileSize + 1024 * 1024)]
        public async Task<IActionResult> SendFile(int channelId, IFormFile? file, [FromForm] string? content)
        {
            var userId = CurrentUserId;
            if (userId == null) return Unauthorized();

            if (file == null || file.Length == 0)
                return BadRequest(new { message = "Lütfen bir dosya seçin." });
            if (file.Length > ObaFileStorage.MaxFileSize)
                return BadRequest(new { message = "Dosya en fazla 25 MB olabilir." });

            var originalName = Path.GetFileName(file.FileName);
            if (originalName.Length > 255) originalName = originalName[^255..];
            if (!ObaFileStorage.IsAllowed(originalName))
                return BadRequest(new { message = "Bu dosya türü desteklenmiyor." });

            var caption = content?.Trim() ?? string.Empty;
            if (caption.Length > 2000) return BadRequest(new { message = "Mesaj en fazla 2000 karakter olabilir." });

            var access = await ResolveAccess(channelId);
            if (access.Channel == null) return NotFound(new { message = "Kanal bulunamadı" });
            if (!access.CanWrite) return StatusCode(403, new { message = "Bu obaya dosya gönderme yetkiniz yok." });

            var storedName = ObaFileStorage.NewStoredName(originalName);
            var path = _storage.PathFor(storedName);

            await using (var stream = new FileStream(path, FileMode.CreateNew))
            {
                await file.CopyToAsync(stream);
            }

            var message = new ObaMessage
            {
                Content = caption,
                ChannelId = channelId,
                UserId = userId.Value,
                CreatedAt = DateTime.UtcNow,
                FileName = originalName,
                FileStoredName = storedName,
                FileContentType = _storage.ContentTypeFor(originalName),
                FileSize = file.Length
            };

            try
            {
                _context.ObaMessages.Add(message);
                await NotifyMentions(access.Channel, caption, userId.Value);
                await _context.SaveChangesAsync();
            }
            catch
            {
                _storage.Delete(storedName); // DB'ye yazılamadıysa diskte çöp bırakma
                throw;
            }

            return Ok(Broadcast(message, userId.Value));
        }

        // GET: api/obamessages/file/{messageId}
        [HttpGet("file/{messageId:int}")]
        public async Task<IActionResult> GetFile(int messageId)
        {
            var message = await _context.ObaMessages
                .AsNoTracking()
                .FirstOrDefaultAsync(m => m.Id == messageId);
            if (message?.FileStoredName == null) return NotFound();

            var access = await ResolveAccess(message.ChannelId);
            if (access.Channel == null) return NotFound();
            if (!access.CanRead) return CurrentUserId == null ? Unauthorized() : StatusCode(403);

            var path = _storage.PathFor(message.FileStoredName);
            if (!System.IO.File.Exists(path)) return NotFound();

            // Tarayıcı içerik türünü tahmin etmesin ve dosyayı API kökeninde sayfa olarak açmasın;
            // önizlemeyi istemci kendi tarafında (blob) yapıyor.
            Response.Headers["X-Content-Type-Options"] = "nosniff";
            return PhysicalFile(
                path,
                message.FileContentType ?? "application/octet-stream",
                message.FileName ?? "dosya",
                enableRangeProcessing: true);
        }

        private object Broadcast(ObaMessage message, int userId)
        {
            var username = User.FindFirst(ClaimTypes.Name)?.Value ?? "Bilinmeyen";
            var dto = ToDto(message, userId, username);

            // Fire and forget SignalR broadcast
            _ = _hubContext.Clients.Group(message.ChannelId.ToString()).SendAsync("ReceiveMessage", dto);
            return dto;
        }
    }
}
