using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Karalevha.API.Data;
using Karalevha.API.Services;
using Karalevha.API.Models;
using Microsoft.AspNetCore.Authorization;

namespace Karalevha.API.Controllers
{
    /// <summary>Herkese açık profil ve sitenin genel araması.</summary>
    [Route("api")]
    [ApiController]
    public class UsersController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly CurrentUser _current;
        private readonly NotificationService _notifications;

        public UsersController(AppDbContext context, CurrentUser current, NotificationService notifications)
        {
            _context = context;
            _current = current;
            _notifications = notifications;
        }

        private Task<User?> FindByName(string username)
        {
            var normalized = username.Trim().ToLowerInvariant();
            return _context.Users.FirstOrDefaultAsync(u => u.NormalizedUsername == normalized);
        }

        // GET: api/users/{username}
        [HttpGet("users/{username}")]
        public async Task<IActionResult> GetProfile(string username)
        {
            var normalized = username.Trim().ToLowerInvariant();
            var user = await _context.Users.AsNoTracking().FirstOrDefaultAsync(u => u.NormalizedUsername == normalized);
            if (user == null) return NotFound(new { message = "Kullanıcı bulunamadı." });

            var projects = await _context.Projects.AsNoTracking().Where(p => p.UserId == user.Id)
                .OrderByDescending(p => p.CreatedAt)
                .Select(p => new { p.Id, p.Title, p.Description, p.RepoUrl, p.CreatedAt })
                .ToListAsync();
            var models = await _context.PrintModels.AsNoTracking().Where(m => m.UserId == user.Id)
                .OrderByDescending(m => m.UploadedAt)
                .Select(m => new { m.Id, m.Title, m.Category, m.FileName, FileUrl = m.FilePath, m.UploadedAt })
                .ToListAsync();
            var posts = await _context.Posts.AsNoTracking().Where(p => p.UserId == user.Id)
                .OrderByDescending(p => p.CreatedAt).Take(20)
                .Select(p => new { p.Id, p.Content, p.CreatedAt })
                .ToListAsync();
            var makes = await _context.PrintMakes.AsNoTracking().Where(m => m.UserId == user.Id)
                .OrderByDescending(m => m.CreatedAt).Take(24)
                .Select(m => new { m.Id, m.PhotoPath, m.PrintModelId, ModelTitle = m.PrintModel!.Title, m.CreatedAt })
                .ToListAsync();
            // Yalnızca herkese açık obalar listelenir
            var obalar = await _context.ObaMembers.AsNoTracking()
                .Where(m => m.UserId == user.Id && !m.Oba!.IsPrivate)
                .Select(m => new { m.Oba!.Id, m.Oba.Name })
                .ToListAsync();

            var me = CurrentUser.IdOf(User);
            var followers = await _context.UserFollows.CountAsync(f => f.FollowingId == user.Id);
            var following = await _context.UserFollows.CountAsync(f => f.FollowerId == user.Id);
            var isFollowing = me != null && await _context.UserFollows.AnyAsync(f => f.FollowerId == me && f.FollowingId == user.Id);

            return Ok(new
            {
                user.Id,
                user.Username,
                JoinedAt = user.CreatedAt,
                user.Bio,
                user.Interests,
                user.Role,
                IsAdmin = Roles.IsStaff(user.Role),
                // Askı bilgisi yalnızca kişinin kendisine ve yöneticilere gösterilir
                BannedUntil = user.BannedUntil > DateTime.UtcNow && (me == user.Id || _current.IsAdmin(User)) ? user.BannedUntil : null,
                FollowerCount = followers,
                FollowingCount = following,
                IsFollowing = isFollowing,
                Projects = projects,
                Models = models.Select(m => new { m.Id, m.Title, m.Category, m.FileUrl, Format = Path.GetExtension(m.FileName).TrimStart('.').ToLowerInvariant(), m.UploadedAt }),
                Posts = posts,
                Makes = makes,
                Obalar = obalar
            });
        }

        // POST: api/users/{username}/follow
        [HttpPost("users/{username}/follow")]
        [Authorize]
        public async Task<IActionResult> Follow(string username)
        {
            var me = CurrentUser.IdOf(User)!.Value;
            var target = await FindByName(username);
            if (target == null) return NotFound(new { message = "Kullanıcı bulunamadı." });
            if (target.Id == me) return BadRequest(new { message = "Kendini takip edemezsin." });

            if (!await _context.UserFollows.AnyAsync(f => f.FollowerId == me && f.FollowingId == target.Id))
            {
                _context.UserFollows.Add(new UserFollow { FollowerId = me, FollowingId = target.Id });
                var name = CurrentUser.NameOf(User);
                _notifications.Add(target.Id, me, $"{name} seni takip etmeye başladı.", $"/u/{name}");
                try
                {
                    await _context.SaveChangesAsync();
                }
                catch (DbUpdateException ex) when (ex.InnerException is Npgsql.PostgresException { SqlState: "23505" })
                {
                    // Aynı anda iki istek: zaten takip ediliyor
                }
            }
            return Ok(new { isFollowing = true, followerCount = await _context.UserFollows.CountAsync(f => f.FollowingId == target.Id) });
        }

        // DELETE: api/users/{username}/follow
        [HttpDelete("users/{username}/follow")]
        [Authorize]
        public async Task<IActionResult> Unfollow(string username)
        {
            var me = CurrentUser.IdOf(User)!.Value;
            var target = await FindByName(username);
            if (target == null) return NotFound(new { message = "Kullanıcı bulunamadı." });

            await _context.UserFollows.Where(f => f.FollowerId == me && f.FollowingId == target.Id).ExecuteDeleteAsync();
            return Ok(new { isFollowing = false, followerCount = await _context.UserFollows.CountAsync(f => f.FollowingId == target.Id) });
        }

        // GET: api/users/{username}/takip?yon=takipci|takip
        // Takipçiler ya da takip edilenler (en fazla 200)
        [HttpGet("users/{username}/takip")]
        public async Task<IActionResult> FollowList(string username, [FromQuery] string yon = "takipci")
        {
            var target = await FindByName(username);
            if (target == null) return NotFound(new { message = "Kullanıcı bulunamadı." });

            var query = yon == "takip"
                ? _context.UserFollows.Where(f => f.FollowerId == target.Id).Select(f => new { f.CreatedAt, f.Following!.Username })
                : _context.UserFollows.Where(f => f.FollowingId == target.Id).Select(f => new { f.CreatedAt, f.Follower!.Username });
            return Ok(await query.OrderByDescending(f => f.CreatedAt).Take(200).Select(f => f.Username).ToListAsync());
        }

        public class UpdateProfileDto
        {
            public string? Bio { get; set; }
            public List<string>? Interests { get; set; }
        }

        // PUT: api/users/me
        [HttpPut("users/me")]
        [Authorize]
        public async Task<IActionResult> UpdateProfile(UpdateProfileDto dto)
        {
            var user = await _context.Users.FindAsync(CurrentUser.IdOf(User));
            if (user == null) return Unauthorized();

            var bio = string.IsNullOrWhiteSpace(dto.Bio) ? null : dto.Bio.Trim();
            if (bio?.Length > 300) return BadRequest(new { message = "Tanıtım en fazla 300 karakter olabilir." });

            user.Bio = bio;
            if (dto.Interests != null) user.Interests = PostTags.Clean(dto.Interests, PostTags.All.Length);
            await _context.SaveChangesAsync();
            return Ok(new { user.Bio, user.Interests });
        }

        /// <summary>Dalların görünen adları (istemcideki projectCategories ile aynı); "robotik" araması dalı bulsun</summary>
        private static readonly Dictionary<string, string> ProjectCategoryLabels = new()
        {
            ["robotik"] = "Robotik", ["elektronik"] = "Elektronik", ["yazilim"] = "Yazılım", ["tasarim"] = "3B tasarım", ["diger"] = "Diğer",
        };

        // GET: api/search?q=...
        [HttpGet("search")]
        public async Task<IActionResult> Search([FromQuery] string? q)
        {
            var term = (q ?? string.Empty).Trim();
            if (term.Length < 2) return Ok(new { projects = Array.Empty<object>(), models = Array.Empty<object>(), obalar = Array.Empty<object>(), users = Array.Empty<object>(), events = Array.Empty<object>(), posts = Array.Empty<object>() });
            if (term.Length > 100) term = term[..100];

            // ILIKE için % ve _ kaçışlanır; büyük/küçük harf duyarsız arama
            var pattern = "%" + term.Replace("\\", "\\\\").Replace("%", "\\%").Replace("_", "\\_") + "%";
            const int take = 6;

            // Projeler yalnızca adıyla değil içeriğiyle de bulunur: dosya ve model adları (ör. "kicad", "step"),
            // ekip, dal ve depo. Sonuçta neden bulunduğu yazılır; adı eşleşenler önce gelir.
            // Dal yalnızca 3+ harfle aranır ("ro" bütün robotik projelerini getirmesin); Türkçe ve ASCII yazım ("yazilim")
            var tr = System.Globalization.CultureInfo.GetCultureInfo("tr-TR").CompareInfo;
            var categories = term.Length < 3 ? new List<string>() : ProjectCategoryLabels
                .Where(c => tr.IndexOf(c.Value, term, System.Globalization.CompareOptions.IgnoreCase) >= 0 || c.Key.Contains(term, StringComparison.OrdinalIgnoreCase))
                .Select(c => c.Key).ToList();
            var projectHits = await _context.Projects.AsNoTracking()
                .Where(p => EF.Functions.ILike(p.Title, pattern, "\\") || EF.Functions.ILike(p.Description, pattern, "\\")
                    || EF.Functions.ILike(p.RepoUrl, pattern, "\\")
                    || EF.Functions.ILike(p.User!.Username, pattern, "\\")
                    || categories.Contains(p.Category)
                    || _context.ProjectMembers.Any(m => m.ProjectId == p.Id && EF.Functions.ILike(m.User!.Username, pattern, "\\"))
                    || _context.ProjectFiles.Any(f => f.ProjectId == p.Id && (EF.Functions.ILike(f.Title, pattern, "\\") || EF.Functions.ILike(f.FileName, pattern, "\\")))
                    || _context.PrintModels.Any(m => m.ProjectId == p.Id && EF.Functions.ILike(m.Title, pattern, "\\")))
                .OrderByDescending(p => EF.Functions.ILike(p.Title, pattern, "\\") ? 1 : 0)
                .ThenByDescending(p => p.CreatedAt)
                .Take(8)
                .Select(p => new
                {
                    p.Id, p.Title, p.Category, p.RepoUrl,
                    Owner = p.User!.Username,
                    TextHit = EF.Functions.ILike(p.Title, pattern, "\\") || EF.Functions.ILike(p.Description, pattern, "\\"),
                    File = _context.ProjectFiles.Where(f => f.ProjectId == p.Id && (EF.Functions.ILike(f.Title, pattern, "\\") || EF.Functions.ILike(f.FileName, pattern, "\\")))
                        .Select(f => f.FileName).FirstOrDefault(),
                    Model = _context.PrintModels.Where(m => m.ProjectId == p.Id && EF.Functions.ILike(m.Title, pattern, "\\")).Select(m => m.Title).FirstOrDefault(),
                    Member = _context.ProjectMembers.Where(m => m.ProjectId == p.Id && EF.Functions.ILike(m.User!.Username, pattern, "\\")).Select(m => m.User!.Username).FirstOrDefault(),
                })
                .ToListAsync();
            var projects = projectHits.Select(p => new
            {
                p.Id,
                p.Title,
                p.Owner,
                // Adı ya da açıklaması eşleşmediyse neden bulunduğu
                Match = p.TextHit ? null
                    : p.File != null ? $"dosya: {p.File}"
                    : p.Model != null ? $"model: {p.Model}"
                    : p.Member != null ? $"ekip: {p.Member}"
                    : categories.Contains(p.Category) ? $"dal: {ProjectCategoryLabels.GetValueOrDefault(p.Category, p.Category)}"
                    : p.Owner.Contains(term, StringComparison.OrdinalIgnoreCase) ? "sahibi"
                    : p.RepoUrl.Contains(term, StringComparison.OrdinalIgnoreCase) ? "depo"
                    : null,
            }).ToList();
            var models = await _context.PrintModels.AsNoTracking()
                .Where(m => EF.Functions.ILike(m.Title, pattern, "\\") || (m.Description != null && EF.Functions.ILike(m.Description, pattern, "\\")))
                .OrderByDescending(m => m.UploadedAt).Take(take)
                .Select(m => new { m.Id, m.Title, m.Category, Uploader = m.User!.Username }).ToListAsync();
            var obalar = await _context.Obalar.AsNoTracking()
                .Where(o => !o.IsUnlisted) // görünmeyen obalar aramada çıkmaz
                .Where(o => EF.Functions.ILike(o.Name, pattern, "\\") || (!o.IsPrivate && o.Description != null && EF.Functions.ILike(o.Description, pattern, "\\")))
                .OrderByDescending(o => o.MemberCount).Take(take)
                .Select(o => new { o.Id, o.Name, o.IsPrivate, o.MemberCount }).ToListAsync();
            var users = await _context.Users.AsNoTracking()
                .Where(u => EF.Functions.ILike(u.Username, pattern, "\\"))
                .OrderBy(u => u.Username).Take(take)
                .Select(u => new { u.Username }).ToListAsync();
            var events = await _context.Events.AsNoTracking()
                .Where(e => EF.Functions.ILike(e.Title, pattern, "\\") || (e.Location != null && EF.Functions.ILike(e.Location, pattern, "\\")))
                .OrderByDescending(e => e.StartsAt).Take(take)
                .Select(e => new { e.Id, e.Title, e.StartsAt, e.Location }).ToListAsync();
            var posts = await _context.Posts.AsNoTracking()
                .Where(p => EF.Functions.ILike(p.Content, pattern, "\\"))
                .OrderByDescending(p => p.CreatedAt).Take(take)
                .Select(p => new { p.Id, p.Content, p.CreatedAt, Username = p.User!.Username }).ToListAsync();

            return Ok(new { projects, models, obalar, users, events, posts });
        }
    }
}
