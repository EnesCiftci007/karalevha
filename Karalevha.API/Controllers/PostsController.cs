using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Karalevha.API.Data;
using Karalevha.API.Models;
using Karalevha.API.DTOs;
using Karalevha.API.Services;

namespace Karalevha.API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class PostsController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly CurrentUser _current;

        public PostsController(AppDbContext context, CurrentUser current)
        {
            _context = context;
            _current = current;
        }

        private IQueryable<object> Project(IQueryable<Post> query) =>
            query.Select(p => new
            {
                p.Id,
                p.Content,
                p.Likes,
                p.CreatedAt,
                p.EditedAt,
                p.Tags,
                User = new { p.User!.Id, p.User.Username, p.User.AvatarSeed }
            });

        private const int MaxTags = 5;

        // GET: api/posts?etiket=Robotik&kapsam=takip
        // Giriş yapan kişinin ilgi alanlarıyla eşleşen son 7 günün gönderileri öne çıkar; geri kalanı yeniden eskiye.
        // kapsam=takip yalnızca takip edilen kişilerin (ve kişinin kendi) gönderilerini getirir.
        [HttpGet]
        public async Task<IActionResult> GetPosts([FromQuery] string? etiket, [FromQuery] string? kapsam)
        {
            var me = CurrentUser.IdOf(User);
            var query = _context.Posts.AsNoTracking();

            if (!string.IsNullOrWhiteSpace(etiket))
            {
                var tag = PostTags.Normalize(etiket);
                if (tag.Length < 2) return Ok(Array.Empty<object>());
                query = query.Where(p => p.Tags.Contains(tag));
            }

            if (kapsam == "takip")
            {
                if (me == null) return Unauthorized();
                var followed = _context.UserFollows.Where(f => f.FollowerId == me).Select(f => f.FollowingId);
                query = query.Where(p => p.UserId == me || followed.Contains(p.UserId));
            }

            var interests = (me == null ? new List<string>()
                : await _context.Users.Where(u => u.Id == me).Select(u => u.Interests).FirstOrDefaultAsync() ?? new List<string>())
                .Select(PostTags.Normalize).ToList(); // "3B Baskı" ilgi alanı "#3bbaskı" etiketine denk
            var boostSince = DateTime.UtcNow.AddDays(-7);
            var boost = interests.Count > 0;

            var ordered = query
                .OrderByDescending(p => boost && p.CreatedAt >= boostSince && p.Tags.Any(t => interests.Contains(t)))
                .ThenByDescending(p => p.CreatedAt)
                .ThenByDescending(p => p.Id);
            return Ok(await Project(ordered).ToListAsync());
        }

        // GET: api/posts/etiketler
        // Gündem: son 7 günde en çok kullanılan 12 etiket. O hafta hiç yoksa tüm zamanların en çokları.
        [HttpGet("etiketler")]
        public async Task<IActionResult> GetTags()
        {
            async Task<List<TagCount>> top(DateTime? since) =>
                await _context.Posts.AsNoTracking()
                    .Where(p => since == null || p.CreatedAt >= since)
                    .SelectMany(p => p.Tags)
                    .GroupBy(t => t)
                    .OrderByDescending(g => g.Count()).ThenBy(g => g.Key)
                    .Take(12)
                    .Select(g => new TagCount(g.Key, g.Count()))
                    .ToListAsync();

            var week = await top(DateTime.UtcNow.AddDays(-7));
            var list = week.Count > 0 ? week : await top(null);
            return Ok(new { recent = week.Count > 0, tags = list.Select(t => new { tag = t.Tag, count = t.Count }) });
        }

        private record TagCount(string Tag, int Count);

        // POST: api/posts
        [HttpPost]
        [Authorize]
        public async Task<IActionResult> CreatePost(CreatePostDto dto)
        {
            var userId = CurrentUser.IdOf(User);
            if (userId == null) return Unauthorized();

            var content = dto.Content.Trim();
            if (content.Length == 0) return BadRequest(new { message = "Gönderi boş olamaz." });

            var post = new Post { Content = content, Tags = PostTags.FromContent(content, MaxTags), UserId = userId.Value, CreatedAt = DateTime.UtcNow };
            _context.Posts.Add(post);
            await _context.SaveChangesAsync();

            var created = await Project(_context.Posts.Where(p => p.Id == post.Id)).FirstAsync();
            return CreatedAtAction(nameof(GetPosts), new { id = post.Id }, created);
        }

        // PUT: api/posts/{id}
        [HttpPut("{id:int}")]
        [Authorize]
        public async Task<IActionResult> UpdatePost(int id, CreatePostDto dto)
        {
            var post = await _context.Posts.FindAsync(id);
            if (post == null) return NotFound(new { message = "Gönderi bulunamadı." });
            // Düzenlemeyi yalnızca yazarı yapabilir; yönetici sadece silebilir
            if (CurrentUser.IdOf(User) != post.UserId) return StatusCode(403, new { message = "Bu gönderiyi düzenleyemezsin." });

            var content = dto.Content.Trim();
            if (content.Length == 0) return BadRequest(new { message = "Gönderi boş olamaz." });

            post.Content = content;
            post.Tags = PostTags.FromContent(content, MaxTags); // metin değişince etiketler de yeniden okunur
            post.EditedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            return Ok(await Project(_context.Posts.Where(p => p.Id == id)).FirstAsync());
        }

        // DELETE: api/posts/{id}
        [HttpDelete("{id:int}")]
        [Authorize]
        public async Task<IActionResult> DeletePost(int id)
        {
            var post = await _context.Posts.FindAsync(id);
            if (post == null) return NotFound(new { message = "Gönderi bulunamadı." });
            if (!_current.CanManage(User, post.UserId)) return StatusCode(403, new { message = "Bu gönderiyi silemezsin." });

            _context.Posts.Remove(post);
            _context.Likes.RemoveRange(_context.Likes.Where(l => l.TargetType == "post" && l.TargetId == id));
            _context.Comments.RemoveRange(_context.Comments.Where(c => c.TargetType == "post" && c.TargetId == id));
            await _context.SaveChangesAsync();
            return Ok(new { success = true });
        }
    }
}
