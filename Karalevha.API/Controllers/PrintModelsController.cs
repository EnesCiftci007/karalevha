using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Karalevha.API.Data;
using Karalevha.API.Models;
using System.Security.Claims;
using Microsoft.AspNetCore.RateLimiting;

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
        public async Task<IActionResult> GetModels([FromQuery] int skip = 0, [FromQuery] int take = 50)
        {
            var models = await _context.PrintModels
                .OrderByDescending(m => m.UploadedAt)
                .Skip(skip)
                .Take(take)
                .Select(m => new
                {
                    m.Id,
                    m.Title,
                    m.Description,
                    m.FileName,
                    FileUrl = $"/uploads/stl/{m.FileName}", 
                    m.UploadedAt,
                    Uploader = m.User.Username
                })
                .ToListAsync();

            return Ok(models);
        }

        // POST: api/printmodels
        [HttpPost]
        [Authorize]
        [EnableRateLimiting("UploadLimiter")]
        [RequestSizeLimit(50_000_000)] // 50 MB sınır
        public async Task<IActionResult> UploadModel([FromForm] string title, [FromForm] string? description, IFormFile file)
        {
            if (file == null || file.Length == 0)
                return BadRequest(new { message = "Lütfen bir STL dosyası seçin." });

            if (!file.FileName.EndsWith(".stl", StringComparison.OrdinalIgnoreCase))
                return BadRequest(new { message = "Sadece .stl uzantılı dosyalar kabul edilir." });

            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier);
            if (userIdClaim == null) return Unauthorized();

            if (!int.TryParse(userIdClaim.Value, out var userId))
                return Unauthorized();

            // Dosya ismi zafiyetlerini (Path Traversal) ve URL bozulmalarını önlemek için sadece GUID kullan
            var safeFileName = $"{Guid.NewGuid()}.stl";
            
            var uploadsFolder = Path.Combine(_env.WebRootPath ?? Path.Combine(Directory.GetCurrentDirectory(), "wwwroot"), "uploads", "stl");
            
            if (!Directory.Exists(uploadsFolder))
                Directory.CreateDirectory(uploadsFolder);

            var absoluteFilePath = Path.Combine(uploadsFolder, safeFileName);
            var relativeFilePath = $"/uploads/stl/{safeFileName}"; // Veritabanına mutlak (C:\...) yol yazılmaz

            await using (var stream = new FileStream(absoluteFilePath, FileMode.Create))
            {
                await file.CopyToAsync(stream);
            }

            var printModel = new PrintModel
            {
                Title = title, // Kullanıcının girdiği orijinal isim başlıkta saklanır
                Description = description,
                FilePath = relativeFilePath, 
                FileName = safeFileName,
                UserId = userId,
                UploadedAt = DateTime.UtcNow
            };

            try
            {
                _context.PrintModels.Add(printModel);
                await _context.SaveChangesAsync();
            }
            catch
            {
                // DB'ye yazılamazsa çöp dosyayı diskten sil
                if (System.IO.File.Exists(absoluteFilePath))
                {
                    System.IO.File.Delete(absoluteFilePath);
                }
                throw;
            }

            return Ok(new { message = "Dosya başarıyla yüklendi!" });
        }
    }
}
