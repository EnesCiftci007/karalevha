using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Karalevha.API.Data;
using Karalevha.API.Models;
using Karalevha.API.Services;

namespace Karalevha.API.Controllers
{
    /// <summary>Gönderi, proje ve modeller için beğeni ve yorum.</summary>
    [Route("api")]
    [ApiController]
    public class SocialController : ControllerBase
    {
        private static readonly HashSet<string> TargetTypes = new() { "post", "project", "model" };

        private readonly AppDbContext _context;
        private readonly CurrentUser _current;
        private readonly NotificationService _notifications;

        public SocialController(AppDbContext context, CurrentUser current, NotificationService notifications)
        {
            _context = context;
            _current = current;
            _notifications = notifications;
        }

        /// <summary>Hedefin sahibini, kısa adını ve sitedeki adresini bulur; hedef yoksa null.</summary>
        private async Task<(int OwnerId, string Label, string Link)?> ResolveTarget(string type, int id)
        {
            switch (type)
            {
                case "post":
                    var post = await _context.Posts.AsNoTracking().FirstOrDefaultAsync(p => p.Id == id);
                    if (post == null) return null;
                    var snippet = post.Content.Length > 40 ? post.Content[..40] + "…" : post.Content;
                    return (post.UserId, $"gönderin (\"{snippet}\")", $"/akis#gonderi-{id}");
                case "project":
                    var project = await _context.Projects.AsNoTracking().FirstOrDefaultAsync(p => p.Id == id);
                    return project == null ? null : (project.UserId, $"\"{project.Title}\" projen", $"/projeler/{id}");
                case "model":
                    var model = await _context.PrintModels.AsNoTracking().FirstOrDefaultAsync(m => m.Id == id);
                    return model == null ? null : (model.UserId, $"\"{model.Title}\" modelin", $"/baski-istasyonu?model={id}");
                default:
                    return null;
            }
        }

        // ------------------------------------------------------------ Beğeni

        // GET: api/begeni/{type}?ids=1,2,3   — toplu beğeni sayısı ve "ben beğendim mi"
        [HttpGet("begeni/{type}")]
        public async Task<IActionResult> GetLikes(string type, [FromQuery] string ids)
        {
            if (!TargetTypes.Contains(type)) return BadRequest(new { message = "Geçersiz tür." });
            var idList = (ids ?? string.Empty).Split(',', StringSplitOptions.RemoveEmptyEntries)
                .Select(s => int.TryParse(s, out var v) ? v : -1).Where(v => v > 0).Distinct().Take(200).ToList();
            var me = CurrentUser.IdOf(User);

            var likes = await _context.Likes.AsNoTracking()
                .Where(l => l.TargetType == type && idList.Contains(l.TargetId))
                .GroupBy(l => l.TargetId)
                .Select(g => new { TargetId = g.Key, Count = g.Count(), Mine = me != null && g.Any(l => l.UserId == me) })
                .ToListAsync();
            var comments = await _context.Comments.AsNoTracking()
                .Where(c => c.TargetType == type && idList.Contains(c.TargetId))
                .GroupBy(c => c.TargetId)
                .Select(g => new { TargetId = g.Key, Count = g.Count() })
                .ToListAsync();

            return Ok(idList.ToDictionary(
                id => id.ToString(),
                id => new
                {
                    Likes = likes.FirstOrDefault(l => l.TargetId == id)?.Count ?? 0,
                    Liked = likes.FirstOrDefault(l => l.TargetId == id)?.Mine ?? false,
                    Comments = comments.FirstOrDefault(c => c.TargetId == id)?.Count ?? 0
                }));
        }

        // POST: api/begeni/{type}/{id}   — beğen / beğenmekten vazgeç
        [HttpPost("begeni/{type}/{id:int}")]
        [Authorize]
        public async Task<IActionResult> ToggleLike(string type, int id)
        {
            if (!TargetTypes.Contains(type)) return BadRequest(new { message = "Geçersiz tür." });
            var userId = CurrentUser.IdOf(User);
            if (userId == null) return Unauthorized();
            if (await ResolveTarget(type, id) == null) return NotFound(new { message = "Bulunamadı." });

            var existing = await _context.Likes.FirstOrDefaultAsync(l => l.TargetType == type && l.TargetId == id && l.UserId == userId);
            if (existing != null) _context.Likes.Remove(existing);
            else _context.Likes.Add(new Like { TargetType = type, TargetId = id, UserId = userId.Value });

            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateException)
            {
                // Aynı anda iki tıklama: benzersiz indeks ikinciyi reddeder, durum zaten doğru
            }

            var count = await _context.Likes.CountAsync(l => l.TargetType == type && l.TargetId == id);
            return Ok(new { liked = existing == null, likes = count });
        }

        // ------------------------------------------------------------ Yorum

        // GET: api/yorum/{type}/{id}
        [HttpGet("yorum/{type}/{id:int}")]
        public async Task<IActionResult> GetComments(string type, int id)
        {
            if (!TargetTypes.Contains(type)) return BadRequest(new { message = "Geçersiz tür." });
            var comments = await _context.Comments.AsNoTracking()
                .Where(c => c.TargetType == type && c.TargetId == id)
                .OrderBy(c => c.CreatedAt)
                .Select(c => new { c.Id, c.Content, c.CreatedAt, c.UserId, Username = c.User!.Username })
                .ToListAsync();
            return Ok(comments);
        }

        public class CommentDto
        {
            public string Content { get; set; } = string.Empty;
        }

        // POST: api/yorum/{type}/{id}
        [HttpPost("yorum/{type}/{id:int}")]
        [Authorize]
        public async Task<IActionResult> AddComment(string type, int id, CommentDto dto)
        {
            if (!TargetTypes.Contains(type)) return BadRequest(new { message = "Geçersiz tür." });
            var userId = CurrentUser.IdOf(User);
            if (userId == null) return Unauthorized();

            var content = dto.Content?.Trim() ?? string.Empty;
            if (content.Length == 0) return BadRequest(new { message = "Yorum boş olamaz." });
            if (content.Length > 1000) return BadRequest(new { message = "Yorum en fazla 1000 karakter olabilir." });

            var target = await ResolveTarget(type, id);
            if (target == null) return NotFound(new { message = "Bulunamadı." });

            // Basit sel koruması: aynı kişi 5 saniyede bir yorum
            var last = await _context.Comments.Where(c => c.UserId == userId).OrderByDescending(c => c.CreatedAt).Select(c => c.CreatedAt).FirstOrDefaultAsync();
            if (last != default && (DateTime.UtcNow - last).TotalSeconds < 5)
                return BadRequest(new { message = "Biraz yavaş: yorumlar arasında birkaç saniye bekle." });

            var comment = new Comment { TargetType = type, TargetId = id, UserId = userId.Value, Content = content };
            _context.Comments.Add(comment);

            var me = CurrentUser.NameOf(User);
            var (ownerId, label, link) = target.Value;
            _notifications.Add(ownerId, userId, $"{me} {label} hakkında yorum yaptı.", link);

            // Yorumda adı geçenlere (@kullanici) de haber ver
            foreach (var mentioned in await MentionedUserIds(content))
                if (mentioned != ownerId)
                    _notifications.Add(mentioned, userId, $"{me} bir yorumda senden bahsetti.", link);

            await _context.SaveChangesAsync();
            return Ok(new { comment.Id, comment.Content, comment.CreatedAt, comment.UserId, Username = me });
        }

        // DELETE: api/yorum/{commentId}
        [HttpDelete("yorum/{commentId:int}")]
        [Authorize]
        public async Task<IActionResult> DeleteComment(int commentId)
        {
            var comment = await _context.Comments.FindAsync(commentId);
            if (comment == null) return NotFound(new { message = "Yorum bulunamadı." });

            // Yorumu yazan, içeriğin sahibi ya da yönetici silebilir
            var target = await ResolveTarget(comment.TargetType, comment.TargetId);
            var me = CurrentUser.IdOf(User);
            if (!(me == comment.UserId || (target != null && me == target.Value.OwnerId) || _current.IsAdmin(User)))
                return StatusCode(403, new { message = "Bu yorumu silemezsin." });

            _context.Comments.Remove(comment);
            await _context.SaveChangesAsync();
            return Ok(new { success = true });
        }

        private static readonly Regex MentionPattern = new(@"(?<![\w@])@([A-Za-z0-9_.\-ğüşıöçĞÜŞİÖÇ]{2,50})", RegexOptions.Compiled);

        /// <summary>Metindeki @kullanıcı adlarını kullanıcı kimliklerine çevirir (en fazla 10).</summary>
        public static async Task<List<int>> MentionedUserIds(AppDbContext context, string text)
        {
            var names = MentionPattern.Matches(text).Select(m => m.Groups[1].Value.ToLowerInvariant()).Distinct().Take(10).ToList();
            if (names.Count == 0) return new List<int>();
            return await context.Users.Where(u => names.Contains(u.NormalizedUsername)).Select(u => u.Id).ToListAsync();
        }

        private Task<List<int>> MentionedUserIds(string text) => MentionedUserIds(_context, text);
    }
}
