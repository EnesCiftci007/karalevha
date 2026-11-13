using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Karalevha.API.Data;
using Karalevha.API.Services;

namespace Karalevha.API.Controllers
{
    /// <summary>Herkese açık profil ve sitenin genel araması.</summary>
    [Route("api")]
    [ApiController]
    public class UsersController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly CurrentUser _current;

        public UsersController(AppDbContext context, CurrentUser current)
        {
            _context = context;
            _current = current;
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

            return Ok(new
            {
                user.Username,
                JoinedAt = user.CreatedAt,
                IsAdmin = _current.IsAdminName(user.Username),
                Projects = projects,
                Models = models.Select(m => new { m.Id, m.Title, m.Category, m.FileUrl, Format = Path.GetExtension(m.FileName).TrimStart('.').ToLowerInvariant(), m.UploadedAt }),
                Posts = posts,
                Makes = makes,
                Obalar = obalar
            });
        }

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

            var projects = await _context.Projects.AsNoTracking()
                .Where(p => EF.Functions.ILike(p.Title, pattern, "\\") || EF.Functions.ILike(p.Description, pattern, "\\"))
                .OrderByDescending(p => p.CreatedAt).Take(take)
                .Select(p => new { p.Id, p.Title, Owner = p.User!.Username }).ToListAsync();
            var models = await _context.PrintModels.AsNoTracking()
                .Where(m => EF.Functions.ILike(m.Title, pattern, "\\") || (m.Description != null && EF.Functions.ILike(m.Description, pattern, "\\")))
                .OrderByDescending(m => m.UploadedAt).Take(take)
                .Select(m => new { m.Id, m.Title, m.Category, Uploader = m.User!.Username }).ToListAsync();
            var obalar = await _context.Obalar.AsNoTracking()
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
