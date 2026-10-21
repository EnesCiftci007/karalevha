using Karalevha.API.Filters;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Karalevha.API.Data;
using Karalevha.API.Models;
using Karalevha.API.DTOs;
using Karalevha.API.Extensions;
using System.Security.Claims;

namespace Karalevha.API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class ProjectsController : ControllerBase
    {
        private readonly AppDbContext _context;

        public ProjectsController(AppDbContext context)
        {
            _context = context;
        }

        // GET: api/projects
        [HttpGet]
        public async Task<IActionResult> GetProjects([FromQuery] int skip = 0, [FromQuery] int take = 50)
        {
            skip = Math.Max(0, skip);
            take = Math.Clamp(take, 1, 100);

            var projects = await _context.Projects
                .OrderByDescending(p => p.CreatedAt)
                .Skip(skip)
                .Take(take)
                .Select(p => new
                {
                    p.Id,
                    p.Title,
                    p.Description,
                    p.RepoUrl,
                    p.Stars,
                    p.Forks,
                    p.CreatedAt,
                    Owner = p.User != null ? p.User.Username : "Bilinmeyen"
                })
                .ToListAsync();

            return Ok(projects);
        }

        // GET: api/projects/{id}
        [HttpGet("{id}")]
        public async Task<IActionResult> GetProject(int id)
        {
            var p = await _context.Projects
                .Where(pr => pr.Id == id)
                .Select(pr => new
                {
                    pr.Id,
                    pr.Title,
                    pr.Description,
                    pr.RepoUrl,
                    pr.Stars,
                    pr.Forks,
                    pr.CreatedAt,
                    Owner = pr.User != null ? pr.User.Username : "Bilinmeyen"
                })
                .FirstOrDefaultAsync();
            
            if (p == null) return NotFound("Proje bulunamadı");
            
            return Ok(p);
        }

        // POST: api/projects
        [HttpPost]
        [Authorize]
        [CheckBanned]
        public async Task<IActionResult> CreateProject(CreateProjectDto dto)
        {
            var userId = User.GetRequiredUserId();
            var username = User.FindFirst(ClaimTypes.Name)?.Value ?? "Bilinmeyen";

            var repoUrl = dto.RepoUrl.Trim();
            if (!Uri.TryCreate(repoUrl, UriKind.Absolute, out var parsedUri) ||
                (parsedUri.Scheme != Uri.UriSchemeHttp && parsedUri.Scheme != Uri.UriSchemeHttps))
            {
                return BadRequest(new { message = "Geçerli bir HTTP/HTTPS Repo URL'si giriniz." });
            }

            var project = new Project
            {
                Title = dto.Title.Trim(),
                Description = dto.Description.Trim(),
                RepoUrl = repoUrl,
                UserId = userId,
                CreatedAt = DateTime.UtcNow
            };

            _context.Projects.Add(project);
            await _context.SaveChangesAsync();

            return CreatedAtAction(nameof(GetProject), new { id = project.Id }, new
            {
                project.Id,
                project.Title,
                project.Description,
                project.RepoUrl,
                project.Stars,
                project.Forks,
                project.CreatedAt,
                Owner = username
            });
        }
    }
}
