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
    public class PrintModelsController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly IWebHostEnvironment _env;

        public PrintModelsController(AppDbContext context, IWebHostEnvironment env)
        {
            _context = context;
            _env = env;
        }

        // GET: api/printmodels
        [HttpGet]
        public async Task<IActionResult> GetModels()
        {
            var models = await _context.PrintModels
                .Include(m => m.User)
                .OrderByDescending(m => m.UploadedAt)
                .Select(m => new
                {
                    m.Id,
                    m.Title,
                    m.Description,
                    m.FileName,
                    FileUrl = $"/uploads/stl/{m.FileName}", // Statik dosya erişimi için url
                    m.UploadedAt,
                    Uploader = m.User.Username
                })
                .ToListAsync();

            return Ok(models);
        }

        // POST: api/printmodels
        [HttpPost]
        [Authorize]
        public async Task<IActionResult> UploadModel([FromForm] string title, [FromForm] string? description, IFormFile file)
        {
            if (file == null || file.Length == 0)
                return BadRequest(new { message = "Lütfen bir STL dosyası seçin." });

            if (!file.FileName.EndsWith(".stl", StringComparison.OrdinalIgnoreCase))
                return BadRequest(new { message = "Sadece .stl uzantılı dosyalar kabul edilir." });

            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier);
            if (userIdClaim == null) return Unauthorized();

            var userId = int.Parse(userIdClaim.Value);

            // Güvenli dosya adı oluştur
            var safeFileName = $"{Guid.NewGuid()}_{Path.GetFileName(file.FileName)}";
            
            // Yüklenecek klasör: wwwroot/uploads/stl
            var uploadsFolder = Path.Combine(_env.WebRootPath ?? Path.Combine(Directory.GetCurrentDirectory(), "wwwroot"), "uploads", "stl");
            
            if (!Directory.Exists(uploadsFolder))
                Directory.CreateDirectory(uploadsFolder);

            var filePath = Path.Combine(uploadsFolder, safeFileName);

            using (var stream = new FileStream(filePath, FileMode.Create))
            {
                await file.CopyToAsync(stream);
            }

            var printModel = new PrintModel
            {
                Title = title,
                Description = description,
                FilePath = filePath,
                FileName = safeFileName,
                UserId = userId,
                UploadedAt = DateTime.UtcNow
            };

            _context.PrintModels.Add(printModel);
            await _context.SaveChangesAsync();

            return Ok(new { message = "Dosya başarıyla yüklendi!" });
        }
    }
}
