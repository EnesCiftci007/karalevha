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
    public class ProjectsController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly CurrentUser _current;

        public ProjectsController(AppDbContext context, CurrentUser current)
        {
            _context = context;
            _current = current;
        }

        private static IQueryable<object> Project(IQueryable<Project> query) =>
            query.Select(p => new
            {
                p.Id,
                p.Title,
                p.Description,
                p.RepoUrl,
                p.Stars,
                p.Forks,
                p.CreatedAt,
                Owner = p.User!.Username
            });

        private static bool IsWebUrl(string url) =>
            Uri.TryCreate(url, UriKind.Absolute, out var uri) && (uri.Scheme == Uri.UriSchemeHttps || uri.Scheme == Uri.UriSchemeHttp);

        // GET: api/projects
        [HttpGet]
        public async Task<IActionResult> GetProjects()
        {
            return Ok(await Project(_context.Projects.AsNoTracking().OrderByDescending(p => p.CreatedAt)).ToListAsync());
        }

        // GET: api/projects/{id}
        [HttpGet("{id:int}")]
        public async Task<IActionResult> GetProject(int id)
        {
            var project = await Project(_context.Projects.AsNoTracking().Where(p => p.Id == id)).FirstOrDefaultAsync();
            return project == null ? NotFound(new { message = "Proje bulunamadı" }) : Ok(project);
        }

        // POST: api/projects
        [HttpPost]
        [Authorize]
        public async Task<IActionResult> CreateProject(CreateProjectDto dto)
        {
            var userId = CurrentUser.IdOf(User);
            if (userId == null) return Unauthorized();
            if (!IsWebUrl(dto.RepoUrl)) return BadRequest(new { message = "Depo adresi http(s) ile başlamalı." });

            var project = new Project
            {
                Title = dto.Title.Trim(),
                Description = dto.Description.Trim(),
                RepoUrl = dto.RepoUrl.Trim(),
                UserId = userId.Value,
                CreatedAt = DateTime.UtcNow
            };

            _context.Projects.Add(project);
            await _context.SaveChangesAsync();

            return CreatedAtAction(nameof(GetProject), new { id = project.Id },
                await Project(_context.Projects.Where(p => p.Id == project.Id)).FirstAsync());
        }

        // PUT: api/projects/{id}
        [HttpPut("{id:int}")]
        [Authorize]
        public async Task<IActionResult> UpdateProject(int id, CreateProjectDto dto)
        {
            var project = await _context.Projects.FindAsync(id);
            if (project == null) return NotFound(new { message = "Proje bulunamadı" });
            if (CurrentUser.IdOf(User) != project.UserId) return StatusCode(403, new { message = "Bu projeyi düzenleyemezsin." });
            if (!IsWebUrl(dto.RepoUrl)) return BadRequest(new { message = "Depo adresi http(s) ile başlamalı." });

            project.Title = dto.Title.Trim();
            project.Description = dto.Description.Trim();
            project.RepoUrl = dto.RepoUrl.Trim();
            await _context.SaveChangesAsync();

            return Ok(await Project(_context.Projects.Where(p => p.Id == id)).FirstAsync());
        }

        // DELETE: api/projects/{id}
        [HttpDelete("{id:int}")]
        [Authorize]
        public async Task<IActionResult> DeleteProject(int id)
        {
            var project = await _context.Projects.FindAsync(id);
            if (project == null) return NotFound(new { message = "Proje bulunamadı" });
            if (!_current.CanManage(User, project.UserId)) return StatusCode(403, new { message = "Bu projeyi silemezsin." });

            _context.Projects.Remove(project);
            _context.Likes.RemoveRange(_context.Likes.Where(l => l.TargetType == "project" && l.TargetId == id));
            _context.Comments.RemoveRange(_context.Comments.Where(c => c.TargetType == "project" && c.TargetId == id));
            await _context.SaveChangesAsync();
            return Ok(new { success = true });
        }
    }
}
