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
                User = new { p.User!.Id, p.User.Username, p.User.AvatarSeed }
            });

        // GET: api/posts
        [HttpGet]
        public async Task<IActionResult> GetPosts()
        {
            var posts = await Project(_context.Posts.AsNoTracking().OrderByDescending(p => p.CreatedAt)).ToListAsync();
            return Ok(posts);
        }

        // POST: api/posts
        [HttpPost]
        [Authorize]
        public async Task<IActionResult> CreatePost(CreatePostDto dto)
        {
            var userId = CurrentUser.IdOf(User);
            if (userId == null) return Unauthorized();

            var content = dto.Content.Trim();
            if (content.Length == 0) return BadRequest(new { message = "Gönderi boş olamaz." });

            var post = new Post { Content = content, UserId = userId.Value, CreatedAt = DateTime.UtcNow };
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
