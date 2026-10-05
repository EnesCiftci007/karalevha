using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Karalevha.API.Data;
using Karalevha.API.Models;
using Karalevha.API.DTOs;
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
        public async Task<IActionResult> GetProjects()
        {
            var projects = await _context.Projects
                .Include(p => p.User)
                .OrderByDescending(p => p.CreatedAt)
                .Select(p => new
                {
                    p.Id,
                    p.Title,
                    p.Description,
                    p.RepoUrl,
                    p.Stars,
                    p.Forks,
                    p.CreatedAt,
                    Owner = p.User.Username
                })
                .ToListAsync();

            return Ok(projects);
        }

        
        // GET: api/projects/{id}
        [HttpGet("{id}")]
        public async Task<IActionResult> GetProject(int id)
        {
            var p = await _context.Projects
                .Include(pr => pr.User)
                .FirstOrDefaultAsync(pr => pr.Id == id);
            
            if (p == null) return NotFound("Proje bulunamadı");
            
            return Ok(new {
                p.Id,
                p.Title,
                p.Description,
                p.RepoUrl,
                p.Stars,
                p.Forks,
                p.CreatedAt,
                Owner = p.User.Username
            });
        }

        // POST: api/projects
        [HttpPost]
        [Authorize]
        public async Task<IActionResult> CreateProject(CreateProjectDto dto)
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier);
            if (userIdClaim == null) return Unauthorized();

            var userId = int.Parse(userIdClaim.Value);
            var username = User.FindFirst(ClaimTypes.Name)?.Value ?? "Bilinmeyen";

            var project = new Project
            {
                Title = dto.Title,
                Description = dto.Description,
                RepoUrl = dto.RepoUrl,
                UserId = userId,
                CreatedAt = DateTime.UtcNow
            };

            _context.Projects.Add(project);
            await _context.SaveChangesAsync();

            return CreatedAtAction(nameof(GetProjects), new { id = project.Id }, new
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
