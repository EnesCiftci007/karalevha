using Karalevha.API.Filters;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Karalevha.API.Data;
using Karalevha.API.Models;
using Karalevha.API.DTOs;
using Karalevha.API.Extensions;

namespace Karalevha.API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class UsersController : ControllerBase
    {
        private readonly AppDbContext _context;

        public UsersController(AppDbContext context)
        {
            _context = context;
        }

        // GET: api/users/search?q={query}
        [HttpGet("search")]
        public async Task<IActionResult> Search([FromQuery] string q)
        {
            if (string.IsNullOrWhiteSpace(q) || q.Trim().Length < 2)
            {
                return Ok(new List<object>());
            }

            var normalizedQuery = q.Trim().ToLowerInvariant();

            var users = await _context.Users
                .Where(u => u.NormalizedUsername.Contains(normalizedQuery) || u.Username.ToLower().Contains(normalizedQuery))
                .Select(u => new
                {
                    u.Username,
                    u.AvatarSeed
                })
                .Take(10)
                .ToListAsync();

            return Ok(users);
        }

        // GET: api/users/{username}
        [HttpGet("{username}")]
        public async Task<IActionResult> GetProfile(string username)
        {
            var currentUserId = User.GetUserId() ?? -1;
            var normalizedUsername = username.Trim().ToLowerInvariant();

            var user = await _context.Users
                .AsNoTracking()
                .FirstOrDefaultAsync(u => u.NormalizedUsername == normalizedUsername);

            if (user == null) return NotFound(new { message = "Kullanıcı bulunamadı." });

            var followerCount = await _context.UserFollows.CountAsync(f => f.FollowingId == user.Id);
            var followingCount = await _context.UserFollows.CountAsync(f => f.FollowerId == user.Id);
            var isFollowing = currentUserId != -1 && await _context.UserFollows.AnyAsync(f => f.FollowerId == currentUserId && f.FollowingId == user.Id);

            var projects = await _context.Projects
                .Where(p => p.UserId == user.Id)
                .OrderByDescending(p => p.CreatedAt)
                .Take(50)
                .Select(p => new
                {
                    p.Id,
                    p.Title,
                    p.Description,
                    p.RepoUrl,
                    p.Stars,
                    p.Forks,
                    p.CreatedAt,
                    Owner = user.Username
                })
                .ToListAsync();

            var printModels = await _context.PrintModels
                .Where(p => p.UserId == user.Id)
                .OrderByDescending(p => p.UploadedAt)
                .Take(50)
                .Select(m => new PrintModelDto
                {
                    Id = m.Id,
                    Title = m.Title,
                    Description = m.Description,
                    FileName = m.FileName,
                    FileUrl = $"/uploads/stl/{m.FileName}",
                    UploadedAt = m.UploadedAt,
                    Uploader = user.Username
                })
                .ToListAsync();

            return Ok(new
            {
                user.Id,
                user.Username,
                user.Bio,
                user.Interests,
                user.AvatarSeed,
                user.CreatedAt,
                user.Role,
                BannedUntil = (user.BannedUntil.HasValue && user.BannedUntil.Value > DateTime.UtcNow) ? user.BannedUntil : null,
                FollowerCount = followerCount,
                FollowingCount = followingCount,
                IsFollowing = isFollowing,
                Projects = projects,
                PrintModels = printModels
            });
        }

        // POST: api/users/{username}/follow
        [HttpPost("{username}/follow")]
        [Authorize]
        [CheckBanned]
        public async Task<IActionResult> Follow(string username)
        {
            var currentUserId = User.GetRequiredUserId();
            var normalizedUsername = username.Trim().ToLowerInvariant();
            var targetUser = await _context.Users.FirstOrDefaultAsync(u => u.NormalizedUsername == normalizedUsername);
            
            if (targetUser == null) return NotFound(new { message = "Kullanıcı bulunamadı." });
            if (targetUser.Id == currentUserId) return BadRequest(new { message = "Kendinizi takip edemezsiniz." });

            var existingFollow = await _context.UserFollows
                .FirstOrDefaultAsync(f => f.FollowerId == currentUserId && f.FollowingId == targetUser.Id);

            if (existingFollow == null)
            {
                try
                {
                    _context.UserFollows.Add(new UserFollow { FollowerId = currentUserId, FollowingId = targetUser.Id });
                    await _context.SaveChangesAsync();
                }
                catch (DbUpdateException)
                {
                    return StatusCode(409, new { message = "Kullanıcı zaten takip ediliyor." });
                }
            }

            return Ok(new { message = "Takip edildi" });
        }

        // POST: api/users/{username}/unfollow
        [HttpPost("{username}/unfollow")]
        [Authorize]
        [CheckBanned]
        public async Task<IActionResult> Unfollow(string username)
        {
            var currentUserId = User.GetRequiredUserId();
            var normalizedUsername = username.Trim().ToLowerInvariant();
            var targetUser = await _context.Users.FirstOrDefaultAsync(u => u.NormalizedUsername == normalizedUsername);
            
            if (targetUser == null) return NotFound(new { message = "Kullanıcı bulunamadı." });

            var existingFollow = await _context.UserFollows
                .FirstOrDefaultAsync(f => f.FollowerId == currentUserId && f.FollowingId == targetUser.Id);

            if (existingFollow != null)
            {
                _context.UserFollows.Remove(existingFollow);
                await _context.SaveChangesAsync();
            }

            return Ok(new { message = "Takipten çıkıldı" });
        }

        // PUT: api/users/me
        [HttpPut("me")]
        [Authorize]
        [CheckBanned]
        public async Task<IActionResult> UpdateProfile([FromBody] UpdateProfileDto dto)
        {
            var currentUserId = User.GetRequiredUserId();
            var user = await _context.Users.FindAsync(currentUserId);
            
            if (user == null) return NotFound();

            if (dto.Interests != null && dto.Interests.Any(i => string.IsNullOrWhiteSpace(i) || i.Length > 30))
                return BadRequest(new { message = "İlgi alanları boş olamaz ve en fazla 30 karakter olabilir." });

            user.Bio = string.IsNullOrWhiteSpace(dto.Bio) ? null : dto.Bio.Trim();
            if (dto.Interests != null)
            {
                user.Interests = dto.Interests.Select(i => i.Trim()).Distinct().ToList();
            }

            await _context.SaveChangesAsync();

            return Ok(new { user.Bio, user.Interests });
        }
    }
}

