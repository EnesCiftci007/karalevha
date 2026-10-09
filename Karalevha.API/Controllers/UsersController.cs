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
            if (string.IsNullOrWhiteSpace(q) || q.Length < 2)
            {
                return Ok(new List<object>());
            }

            var normalizedQuery = q.ToLowerInvariant();

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
            var currentUserId = -1;
            if (User.Identity?.IsAuthenticated == true)
            {
                var idClaim = User.FindFirst(ClaimTypes.NameIdentifier);
                if (idClaim != null) currentUserId = int.Parse(idClaim.Value);
            }

            var user = await _context.Users
                .Include(u => u.Followers)
                .Include(u => u.Following)
                .FirstOrDefaultAsync(u => u.NormalizedUsername == username.ToLowerInvariant());

            if (user == null) return NotFound("KullanÄ±cÄ± bulunamadÄ±");

            var projects = await _context.Projects
                .Where(p => p.UserId == user.Id)
                .OrderByDescending(p => p.CreatedAt)
                .ToListAsync();

            var printModels = await _context.PrintModels
                .Where(p => p.UserId == user.Id)
                .OrderByDescending(p => p.UploadedAt)
                .ToListAsync();

            var isFollowing = user.Followers.Any(f => f.FollowerId == currentUserId);

            return Ok(new {
                user.Id,
                user.Username,
                user.Bio,
                user.Interests,
                user.AvatarSeed,
                user.CreatedAt,
                FollowerCount = user.Followers.Count,
                FollowingCount = user.Following.Count,
                IsFollowing = isFollowing,
                Projects = projects,
                PrintModels = printModels
            });
        }

        // POST: api/users/{username}/follow
        [HttpPost("{username}/follow")]
        [Authorize]
        public async Task<IActionResult> Follow(string username)
        {
            var currentUserId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
            var targetUser = await _context.Users.FirstOrDefaultAsync(u => u.NormalizedUsername == username.ToLowerInvariant());
            
            if (targetUser == null) return NotFound("KullanÄ±cÄ± bulunamadÄ±");
            if (targetUser.Id == currentUserId) return BadRequest("Kendinizi takip edemezsiniz");

            var existingFollow = await _context.UserFollows
                .FirstOrDefaultAsync(f => f.FollowerId == currentUserId && f.FollowingId == targetUser.Id);

            if (existingFollow == null) { try { _context.UserFollows.Add(new UserFollow { FollowerId = currentUserId, FollowingId = targetUser.Id }); await _context.SaveChangesAsync(); } catch (Microsoft.EntityFrameworkCore.DbUpdateException) { return StatusCode(409, "Kullanıcı zaten takip ediliyor."); } }

            return Ok(new { message = "Takip edildi" });
        }

        // POST: api/users/{username}/unfollow
        [HttpPost("{username}/unfollow")]
        [Authorize]
        public async Task<IActionResult> Unfollow(string username)
        {
            var currentUserId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
            var targetUser = await _context.Users.FirstOrDefaultAsync(u => u.NormalizedUsername == username.ToLowerInvariant());
            
            if (targetUser == null) return NotFound("KullanÄ±cÄ± bulunamadÄ±");

            var existingFollow = await _context.UserFollows
                .FirstOrDefaultAsync(f => f.FollowerId == currentUserId && f.FollowingId == targetUser.Id);

            if (existingFollow != null)
            {
                _context.UserFollows.Remove(existingFollow);
                await _context.SaveChangesAsync();
            }

            return Ok(new { message = "Takipten Ã§Ä±kÄ±ldÄ±" });
        }

        public class UpdateProfileDto {
            public string? Bio { get; set; }
            public List<string>? Interests { get; set; }
        }

        // PUT: api/users/me
        [HttpPut("me")]
        [Authorize]
        public async Task<IActionResult> UpdateProfile([FromBody] UpdateProfileDto dto)
        {
            var currentUserId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
            var user = await _context.Users.FindAsync(currentUserId);
            
            if (user == null) return NotFound();

            user.Bio = dto.Bio;
            if (dto.Interests != null)
            {
                user.Interests = dto.Interests;
            }

            await _context.SaveChangesAsync();

            return Ok(new { user.Bio, user.Interests });
        }
    }
}

