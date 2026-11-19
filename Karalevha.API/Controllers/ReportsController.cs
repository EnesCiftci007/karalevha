using Karalevha.API.Data;
using Karalevha.API.Models;
using Karalevha.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;

namespace Karalevha.API.Controllers
{
    /// <summary>
    /// Şikâyetler: üyeler uygunsuz içeriği bildirir, kulüp yöneticileri tek yerden inceler.
    /// İçeriğin kendisi mevcut silme uçlarından (yönetici yetkisiyle) kaldırılır; burada karar kaydedilir
    /// ve bildiren kişiye sonuç haber verilir.
    /// </summary>
    [Route("api/sikayetler")]
    [ApiController]
    [Authorize]
    public class ReportsController : ControllerBase
    {
        public static readonly string[] TargetTypes = { "project", "model", "post", "comment", "obamessage", "user" };
        public static readonly string[] Reasons = { "spam", "uygunsuz", "taciz", "telif", "diger" };

        private readonly AppDbContext _context;
        private readonly CurrentUser _current;
        private readonly NotificationService _notifications;
        private readonly ObaAccess _obaAccess;

        public ReportsController(AppDbContext context, CurrentUser current, NotificationService notifications, ObaAccess obaAccess)
        {
            _context = context;
            _current = current;
            _notifications = notifications;
            _obaAccess = obaAccess;
        }

        /// <summary>Bildirilen içeriğin özeti: kimin, ne, nerede. İçerik silinmişse null.</summary>
        private sealed record Target(int AuthorId, string Author, string Summary, string Link);

        private static string Clip(string? text, int max = 120)
        {
            text = (text ?? string.Empty).ReplaceLineEndings(" ").Trim();
            return text.Length > max ? text[..max] + "…" : text;
        }

        private async Task<Target?> Describe(string type, int id)
        {
            switch (type)
            {
                case "project":
                    return await _context.Projects.AsNoTracking().Where(p => p.Id == id)
                        .Select(p => new Target(p.UserId, p.User!.Username, p.Title, "/projeler/" + p.Id)).FirstOrDefaultAsync();
                case "model":
                    return await _context.PrintModels.AsNoTracking().Where(m => m.Id == id)
                        .Select(m => new Target(m.UserId, m.User!.Username, m.Title, "/model/" + m.Id)).FirstOrDefaultAsync();
                case "post":
                    var post = await _context.Posts.AsNoTracking().Where(p => p.Id == id)
                        .Select(p => new { p.UserId, p.User!.Username, p.Content }).FirstOrDefaultAsync();
                    return post == null ? null : new Target(post.UserId, post.Username, Clip(post.Content), $"/akis#gonderi-{id}");
                case "comment":
                    var comment = await _context.Comments.AsNoTracking().Where(c => c.Id == id)
                        .Select(c => new { c.UserId, c.User!.Username, c.Content, c.TargetType, c.TargetId }).FirstOrDefaultAsync();
                    if (comment == null) return null;
                    var parent = await Describe(comment.TargetType, comment.TargetId);
                    return new Target(comment.UserId, comment.Username, Clip(comment.Content), parent?.Link ?? "/");
                case "obamessage":
                    var message = await _context.ObaMessages.AsNoTracking().Where(m => m.Id == id)
                        .Select(m => new { m.UserId, m.User!.Username, m.Content, m.FileName, m.ChannelId, ObaId = m.Channel!.ObaId }).FirstOrDefaultAsync();
                    return message == null ? null : new Target(message.UserId, message.Username,
                        Clip(string.IsNullOrWhiteSpace(message.Content) ? message.FileName : message.Content),
                        $"/e-oba/{message.ObaId}?kanal={message.ChannelId}");
                case "user":
                    return await _context.Users.AsNoTracking().Where(u => u.Id == id)
                        .Select(u => new Target(u.Id, u.Username, u.Username, "/u/" + u.Username)).FirstOrDefaultAsync();
                default:
                    return null;
            }
        }

        public class CreateReportDto
        {
            public string TargetType { get; set; } = string.Empty;
            public int TargetId { get; set; }
            public string Reason { get; set; } = string.Empty;
            public string? Note { get; set; }
        }

        // POST: api/sikayetler
        [HttpPost]
        [EnableRateLimiting("ReportLimiter")]
        public async Task<IActionResult> Create(CreateReportDto dto)
        {
            var me = CurrentUser.IdOf(User)!.Value;
            if (!TargetTypes.Contains(dto.TargetType)) return BadRequest(new { message = "Bu içerik bildirilemez." });
            if (!Reasons.Contains(dto.Reason)) return BadRequest(new { message = "Bir neden seç." });
            var note = string.IsNullOrWhiteSpace(dto.Note) ? null : dto.Note.Trim();
            if (note?.Length > 500) return BadRequest(new { message = "Açıklama en fazla 500 karakter olabilir." });

            if (dto.TargetType == "obamessage")
            {
                var channelId = await _context.ObaMessages.AsNoTracking()
                    .Where(m => m.Id == dto.TargetId)
                    .Select(m => (int?)m.ChannelId)
                    .FirstOrDefaultAsync();
                if (channelId == null) return NotFound(new { message = "İçerik bulunamadı; kaldırılmış olabilir." });
                var channel = await _context.ObaChannels.AsNoTracking()
                    .Include(c => c.Oba)
                    .FirstOrDefaultAsync(c => c.Id == channelId.Value);
                if (channel?.Oba == null) return NotFound(new { message = "İçerik bulunamadı; kaldırılmış olabilir." });
                var (canRead, _) = await _obaAccess.ChannelAsync(channel, me);
                if (!canRead) return NotFound(new { message = "İçerik bulunamadı; kaldırılmış olabilir." });
            }

            var target = await Describe(dto.TargetType, dto.TargetId);
            if (target == null) return NotFound(new { message = "İçerik bulunamadı; kaldırılmış olabilir." });
            if (target.AuthorId == me) return BadRequest(new { message = "Kendi içeriğini bildiremezsin." });

            const string thanks = "Bildirimin kulüp yöneticilerine iletildi. Teşekkürler.";
            var open = _context.Reports.Where(r => r.TargetType == dto.TargetType && r.TargetId == dto.TargetId && r.Status == ReportStatus.Open);
            // Aynı kişi aynı içeriği bir kez bildirir; ikinci kez basınca da aynı teşekkür
            if (await open.AnyAsync(r => r.ReporterId == me)) return Ok(new { message = thanks });
            var firstReport = !await open.AnyAsync();

            _context.Reports.Add(new Report { ReporterId = me, TargetType = dto.TargetType, TargetId = dto.TargetId, Reason = dto.Reason, Note = note });

            // Yöneticilere ilk şikâyette haber ver; aynı içerik için gelen sonrakiler zili doldurmasın
            if (firstReport)
            {
                var staff = await _context.Users.Where(u => (u.Role == Roles.Admin || u.Role == Roles.Owner) && u.Id != target.AuthorId)
                    .Select(u => u.Id).ToListAsync();
                foreach (var id in staff)
                    _notifications.Add(id, null, $"Yeni şikâyet: \"{Clip(target.Summary, 60)}\"", "/yonetim");
            }
            await _context.SaveChangesAsync();
            return Ok(new { message = thanks });
        }

        // GET: api/sikayetler?durum=acik|kapali   (yönetici) — içeriğe göre gruplanmış
        [HttpGet]
        public async Task<IActionResult> List([FromQuery] string? durum)
        {
            if (!_current.IsAdmin(User)) return StatusCode(403, new { message = "Şikâyetleri yalnızca kulüp yöneticileri görür." });
            var closed = durum == "kapali";

            var reports = await _context.Reports.AsNoTracking()
                .Where(r => closed ? r.Status != ReportStatus.Open : r.Status == ReportStatus.Open)
                .OrderByDescending(r => r.CreatedAt)
                .Take(closed ? 300 : 1000)
                .Select(r => new
                {
                    r.Id, r.TargetType, r.TargetId, r.Reason, r.Note, r.Status, r.CreatedAt, r.ResolvedAt, r.ResolutionNote,
                    Reporter = r.Reporter!.Username,
                    ResolvedBy = _context.Users.Where(u => u.Id == r.ResolvedById).Select(u => u.Username).FirstOrDefault(),
                })
                .ToListAsync();

            var groups = new List<object>();
            foreach (var g in reports.GroupBy(r => (r.TargetType, r.TargetId)))
            {
                var target = await Describe(g.Key.TargetType, g.Key.TargetId);
                var latest = g.First();
                groups.Add(new
                {
                    g.Key.TargetType,
                    g.Key.TargetId,
                    Exists = target != null,
                    Summary = target?.Summary,
                    Link = target?.Link,
                    AuthorId = target?.AuthorId,
                    Author = target?.Author,
                    Count = g.Count(),
                    Reasons = g.GroupBy(r => r.Reason).Select(x => new { Reason = x.Key, Count = x.Count() }).OrderByDescending(x => x.Count),
                    Reports = g.Select(r => new { r.Id, r.Reporter, r.Reason, r.Note, r.CreatedAt }),
                    LastAt = latest.CreatedAt,
                    Status = closed ? latest.Status : ReportStatus.Open,
                    latest.ResolvedAt,
                    latest.ResolvedBy,
                    latest.ResolutionNote,
                });
            }
            return Ok(groups);
        }

        // GET: api/sikayetler/sayi   (yönetici) — bekleyen içerik sayısı (menüdeki rozet)
        [HttpGet("sayi")]
        public async Task<IActionResult> OpenCount()
        {
            if (!_current.IsAdmin(User)) return Ok(new { count = 0 });
            var count = await _context.Reports.Where(r => r.Status == ReportStatus.Open)
                .Select(r => new { r.TargetType, r.TargetId }).Distinct().CountAsync();
            return Ok(new { count });
        }

        public class DecisionDto
        {
            public string TargetType { get; set; } = string.Empty;
            public int TargetId { get; set; }
            /// <summary>kaldirildi ya da reddedildi</summary>
            public string Status { get; set; } = string.Empty;
            public string? Note { get; set; }
        }

        // POST: api/sikayetler/karar   (yönetici) — içeriğin bütün açık şikâyetlerini kapatır
        [HttpPost("karar")]
        public async Task<IActionResult> Decide(DecisionDto dto)
        {
            if (!_current.IsAdmin(User)) return StatusCode(403, new { message = "Bu işlem kulüp yöneticilerine açık." });
            if (dto.Status != ReportStatus.Removed && dto.Status != ReportStatus.Dismissed) return BadRequest(new { message = "Geçersiz karar." });
            var note = string.IsNullOrWhiteSpace(dto.Note) ? null : dto.Note.Trim();
            if (note?.Length > 500) return BadRequest(new { message = "Not en fazla 500 karakter olabilir." });

            var open = await _context.Reports
                .Where(r => r.TargetType == dto.TargetType && r.TargetId == dto.TargetId && r.Status == ReportStatus.Open)
                .ToListAsync();
            if (open.Count == 0) return NotFound(new { message = "Bu içerik için açık şikâyet yok." });

            // "Kaldırıldı" demek için içerik gerçekten kalkmış (kişi için: askıya alınmış) olmalı
            if (dto.Status == ReportStatus.Removed)
            {
                var stillThere = dto.TargetType == "user"
                    ? await _context.Users.AnyAsync(u => u.Id == dto.TargetId && (u.BannedUntil == null || u.BannedUntil <= DateTime.UtcNow))
                    : await Describe(dto.TargetType, dto.TargetId) != null;
                if (stillThere)
                    return BadRequest(new { message = dto.TargetType == "user" ? "Önce kişiyi askıya al." : "İçerik hâlâ duruyor; önce kaldır." });
            }

            var me = CurrentUser.IdOf(User);
            foreach (var r in open)
            {
                r.Status = dto.Status;
                r.ResolvedById = me;
                r.ResolvedAt = DateTime.UtcNow;
                r.ResolutionNote = note;
            }

            // Bildirenlere sonucu haber ver (kimin karar verdiği yazılmaz)
            var text = dto.Status == ReportStatus.Removed
                ? "Bildirdiğin içerik kurallara aykırı bulundu ve kaldırıldı. Teşekkürler."
                : "Bildirdiğin içerik incelendi; kurallara aykırı bulunmadı.";
            foreach (var reporter in open.Select(r => r.ReporterId).Distinct())
                _notifications.Add(reporter, null, text, "/");

            await _context.SaveChangesAsync();
            return Ok(new { closed = open.Count });
        }
    }
}
