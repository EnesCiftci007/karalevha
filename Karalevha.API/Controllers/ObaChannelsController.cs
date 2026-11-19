using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Karalevha.API.Data;
using Karalevha.API.Models;
using Karalevha.API.Services;

namespace Karalevha.API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class ObaChannelsController : ControllerBase
    {
        private const int MaxChannelsPerOba = 50;
        private const string DefaultCategory = "METİN KANALLARI";
        private static readonly CultureInfo Tr = CultureInfo.GetCultureInfo("tr-TR");

        private readonly AppDbContext _context;
        private readonly ObaAccess _access;
        private readonly ObaFileStorage _storage;
        private readonly NotificationService _notifications;
        private readonly ChannelAccessGuard _guard;

        public ObaChannelsController(AppDbContext context, ObaAccess access, ObaFileStorage storage, NotificationService notifications, ChannelAccessGuard guard)
        {
            _guard = guard;
            _context = context;
            _access = access;
            _storage = storage;
            _notifications = notifications;
        }

        private int? UserId => CurrentUser.IdOf(User);

        private static object ToDto(ObaChannel c, int? userId) => new
        {
            c.Id,
            c.Name,
            c.Type,
            c.Category,
            c.IsPrivate,
            CanManage = ObaAccess.CanManage(c, userId),
        };

        // GET: api/obachannels/{obaId}
        // Açık obalar herkese okunur; yazmak için "Katıl" ile üye olunur. Gizli obalar üyelik ister.
        // Gizli kanallar yalnızca görebilen kişilere listelenir.
        [HttpGet("{obaId:int}")]
        public async Task<IActionResult> GetChannels(int obaId)
        {
            var userId = UserId;
            var oba = await _context.Obalar.FindAsync(obaId);
            if (oba == null) return NotFound("Oba bulunamadı");

            if (oba.IsPrivate && !await _access.IsInsideAsync(oba, userId))
            {
                // Görünmeyen oba: varlığını da belli etme, davet olmadan girilmez
                if (oba.IsUnlisted) return NotFound("Oba bulunamadı");
                if (userId == null) return Unauthorized();
                return StatusCode(403, "Bu gizli bir oba, katılmak için şifre girmelisiniz.");
            }

            var channels = await _access.VisibleChannels(oba, userId)
                .OrderBy(c => c.CreatedAt).ThenBy(c => c.Id)
                .ToListAsync();
            foreach (var c in channels) c.Oba = oba;

            return Ok(channels.Select(c => ToDto(c, userId)));
        }

        // GET: api/obachannels/{obaId}/kisiler
        // Kanala eklenebilecek kişiler: kurucu ve üyeler. Yalnızca obanın içindekiler görür.
        [HttpGet("{obaId:int}/kisiler")]
        [Authorize]
        public async Task<IActionResult> GetPeople(int obaId)
        {
            var oba = await _context.Obalar.Include(o => o.Owner).FirstOrDefaultAsync(o => o.Id == obaId);
            if (oba == null) return NotFound(new { message = "Oba bulunamadı" });
            if (!await _access.IsInsideAsync(oba, UserId)) return StatusCode(403, new { message = "Bu obanın üyesi değilsin." });

            var members = await _context.ObaMembers
                .Where(m => m.ObaId == obaId && m.UserId != oba.OwnerId)
                .OrderBy(m => m.User!.Username)
                .Select(m => new { m.User!.Id, m.User.Username, IsOwner = false })
                .ToListAsync();

            return Ok(members.Prepend(new { oba.Owner!.Id, oba.Owner.Username, IsOwner = true }));
        }

        public class ChannelDto
        {
            public string Name { get; set; } = string.Empty;
            public string? Category { get; set; }
            public bool IsPrivate { get; set; }
            public List<int>? MemberIds { get; set; }
        }

        /// <summary>"Çıkmış Sorular" -> "çıkmış-sorular". Harf, rakam, - ve _ kalır.</summary>
        private static string Slug(string name)
        {
            var lower = name.Trim().ToLower(Tr);
            var sb = new StringBuilder();
            foreach (var ch in lower)
            {
                if (char.IsLetterOrDigit(ch) || ch == '_' || ch == '-') sb.Append(ch);
                else if (char.IsWhiteSpace(ch) || ch == '.') sb.Append('-');
            }
            return Regex.Replace(sb.ToString(), "-{2,}", "-").Trim('-');
        }

        private static string? CleanCategory(string? category)
        {
            var c = Regex.Replace(category?.Trim() ?? string.Empty, @"\s+", " ");
            if (c.Length == 0) return DefaultCategory;
            return c.Length > 50 ? null : c.ToUpper(Tr);
        }

        /// <summary>Ad ve bölümü doğrular. Hata varsa mesajını döner.</summary>
        private async Task<(string? Error, string Name, string Category)> Validate(ChannelDto dto, int obaId, int? exceptChannelId)
        {
            var name = Slug(dto.Name ?? string.Empty);
            if (name.Length == 0) return ("Kanal adı boş olamaz.", name, "");
            if (name.Length > 50) return ("Kanal adı en fazla 50 karakter olabilir.", name, "");

            var category = CleanCategory(dto.Category);
            if (category == null) return ("Bölüm adı en fazla 50 karakter olabilir.", name, "");

            var taken = await _context.ObaChannels.AnyAsync(c => c.ObaId == obaId && c.Name == name && c.Id != exceptChannelId);
            if (taken) return ($"Bu obada #{name} adında bir kanal zaten var.", name, category);
            return (null, name, category);
        }

        /// <summary>Seçilen kişilerden yalnızca obanın içindekiler kalır.</summary>
        private async Task<List<int>> InsidePeople(Oba oba, IEnumerable<int>? ids)
        {
            var wanted = (ids ?? Enumerable.Empty<int>()).Distinct().Take(500).ToList();
            if (wanted.Count == 0) return wanted;
            var members = await _context.ObaMembers.Where(m => m.ObaId == oba.Id && wanted.Contains(m.UserId)).Select(m => m.UserId).ToListAsync();
            if (wanted.Contains(oba.OwnerId)) members.Add(oba.OwnerId);
            return members.Distinct().ToList();
        }

        private void NotifyAdded(Oba oba, ObaChannel channel, IEnumerable<int> userIds, int actorId)
        {
            var actor = CurrentUser.NameOf(User);
            foreach (var id in userIds)
                _notifications.Add(id, actorId, $"{actor} seni {oba.Name} obasındaki #{channel.Name} kanalına ekledi.", $"/e-oba/{oba.Id}?kanal={channel.Id}");
        }

        // POST: api/obachannels/{obaId}
        // Obanın her üyesi metin kanalı açabilir. Gizli kanalda seçilen kişiler eklenir.
        [HttpPost("{obaId:int}")]
        [Authorize]
        public async Task<IActionResult> CreateChannel(int obaId, [FromBody] ChannelDto dto)
        {
            var userId = UserId!.Value;
            var oba = await _context.Obalar.FindAsync(obaId);
            if (oba == null) return NotFound(new { message = "Oba bulunamadı" });
            if (!await _access.IsInsideAsync(oba, userId)) return StatusCode(403, new { message = "Kanal açmak için obanın üyesi olmalısın." });

            if (await _context.ObaChannels.CountAsync(c => c.ObaId == obaId) >= MaxChannelsPerOba)
                return BadRequest(new { message = $"Bir obada en fazla {MaxChannelsPerOba} kanal olabilir." });

            var (error, name, category) = await Validate(dto, obaId, null);
            if (error != null) return BadRequest(new { message = error });

            var channel = new ObaChannel
            {
                Name = name,
                Type = "text",
                Category = category,
                ObaId = obaId,
                Oba = oba,
                IsPrivate = dto.IsPrivate,
                CreatedById = userId,
                CreatedAt = DateTime.UtcNow,
            };
            _context.ObaChannels.Add(channel);

            var added = new List<int>();
            if (dto.IsPrivate)
            {
                added = (await InsidePeople(oba, dto.MemberIds)).Where(id => id != userId).ToList();
                foreach (var id in added) _context.ObaChannelMembers.Add(new ObaChannelMember { Channel = channel, UserId = id });
            }
            await _context.SaveChangesAsync();

            if (added.Count > 0)
            {
                NotifyAdded(oba, channel, added, userId);
                await _context.SaveChangesAsync();
            }

            return Ok(ToDto(channel, userId));
        }

        // GET: api/obachannels/kanal/{channelId}
        // Kanalın ayrıntısı ve gizliyse içindeki kişiler.
        [HttpGet("kanal/{channelId:int}")]
        public async Task<IActionResult> GetChannel(int channelId)
        {
            var channel = await _context.ObaChannels.Include(c => c.Oba).FirstOrDefaultAsync(c => c.Id == channelId);
            if (channel?.Oba == null) return NotFound(new { message = "Kanal bulunamadı" });
            var userId = UserId;
            var (canRead, _) = await _access.ChannelAsync(channel, userId);
            if (!canRead) return userId == null ? Unauthorized() : StatusCode(403);

            var memberIds = channel.IsPrivate
                ? await _access.PrivateChannelReadersAsync(channel)
                : new HashSet<int>();
            var members = await _context.Users
                .Where(u => memberIds.Contains(u.Id))
                .OrderBy(u => u.Username)
                .Select(u => new { u.Id, u.Username })
                .ToListAsync();
            var createdBy = channel.CreatedById == null ? null
                : await _context.Users.Where(u => u.Id == channel.CreatedById).Select(u => u.Username).FirstOrDefaultAsync();

            return Ok(new
            {
                channel.Id,
                channel.Name,
                channel.Category,
                channel.IsPrivate,
                CanManage = ObaAccess.CanManage(channel, userId),
                CreatedBy = createdBy,
                OwnerId = channel.Oba.OwnerId,
                CreatedById = channel.CreatedById,
                Members = members,
            });
        }

        // PUT: api/obachannels/kanal/{channelId}
        // Kanalı açan kişi ya da oba kurucusu: ad, bölüm, gizlilik ve kişiler.
        [HttpPut("kanal/{channelId:int}")]
        [Authorize]
        public async Task<IActionResult> UpdateChannel(int channelId, [FromBody] ChannelDto dto)
        {
            var userId = UserId!.Value;
            var channel = await _context.ObaChannels.Include(c => c.Oba).FirstOrDefaultAsync(c => c.Id == channelId);
            if (channel?.Oba == null) return NotFound(new { message = "Kanal bulunamadı" });
            if (!ObaAccess.CanManage(channel, userId)) return StatusCode(403, new { message = "Bu kanalı yalnızca açan kişi ya da oba kurucusu düzenleyebilir." });

            var (error, name, category) = await Validate(dto, channel.ObaId, channel.Id);
            if (error != null) return BadRequest(new { message = error });

            channel.Name = name;
            channel.Category = category;
            channel.IsPrivate = dto.IsPrivate;

            var current = await _context.ObaChannelMembers.Where(m => m.ChannelId == channelId).ToListAsync();
            var added = new List<int>();
            if (dto.IsPrivate)
            {
                // Kurucu ve kanalı açan her zaman görür; listede tutulmaları gerekmez
                var wanted = (await InsidePeople(channel.Oba, dto.MemberIds))
                    .Where(id => id != channel.Oba.OwnerId && id != channel.CreatedById)
                    .ToHashSet();
                _context.ObaChannelMembers.RemoveRange(current.Where(m => !wanted.Contains(m.UserId)));
                added = wanted.Except(current.Select(m => m.UserId)).ToList();
                foreach (var id in added) _context.ObaChannelMembers.Add(new ObaChannelMember { ChannelId = channelId, UserId = id });
            }
            else
            {
                _context.ObaChannelMembers.RemoveRange(current);
            }

            NotifyAdded(channel.Oba, channel, added, userId);
            await _context.SaveChangesAsync();
            // Gizlendi ya da kişi listesinden çıkarılan varsa açık bağlantıları gruptan çıkar
            await _guard.RecheckChannelsAsync(new[] { channelId });
            return Ok(ToDto(channel, userId));
        }

        // DELETE: api/obachannels/kanal/{channelId}
        // Kanalı açan kişi ya da oba kurucusu. Obanın son kanalı silinemez.
        [HttpDelete("kanal/{channelId:int}")]
        [Authorize]
        public async Task<IActionResult> DeleteChannel(int channelId)
        {
            var channel = await _context.ObaChannels.Include(c => c.Oba).FirstOrDefaultAsync(c => c.Id == channelId);
            if (channel?.Oba == null) return NotFound(new { message = "Kanal bulunamadı" });
            if (!ObaAccess.CanManage(channel, UserId)) return StatusCode(403, new { message = "Bu kanalı yalnızca açan kişi ya da oba kurucusu silebilir." });

            if (await _context.ObaChannels.CountAsync(c => c.ObaId == channel.ObaId) <= 1)
                return BadRequest(new { message = "Obanın son kanalı silinemez." });

            var messages = await _context.ObaMessages.Where(m => m.ChannelId == channelId).ToListAsync();
            var stored = messages.Where(m => m.FileStoredName != null).Select(m => m.FileStoredName!).ToList();
            _context.ObaMessages.RemoveRange(messages);
            _context.ObaChannels.Remove(channel); // kişi kayıtları veritabanında kendiliğinden silinir
            await _context.SaveChangesAsync();
            await _guard.RecheckChannelsAsync(new[] { channelId }); // kanal yok: dinleyen herkes çıkar

            foreach (var s in stored) await _storage.DeleteAsync(s);
            return Ok(new { success = true });
        }
    }
}
