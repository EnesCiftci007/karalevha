using System.Text;
using Karalevha.API.Filters;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Karalevha.API.Data;
using Karalevha.API.DTOs;
using Karalevha.API.Extensions;
using Karalevha.API.Models;
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
            skip = Math.Max(skip, 0);
            take = Math.Clamp(take, 1, 100);

            var models = await _context.PrintModels
                .OrderByDescending(m => m.UploadedAt)
                .Skip(skip)
                .Take(take)
                .Select(m => new PrintModelDto
                {
                    Id = m.Id,
                    Title = m.Title,
                    Description = m.Description,
                    FileName = m.FileName,
                    FileUrl = $"/uploads/stl/{m.FileName}",
                    UploadedAt = m.UploadedAt,
                    Uploader = m.User != null ? m.User.Username : "Bilinmeyen"
                })
                .ToListAsync();

            return Ok(models);
        }

        // POST: api/printmodels
        [HttpPost]
        [Authorize]
        [CheckBanned]
        [EnableRateLimiting("UploadLimiter")]
        [RequestSizeLimit(50_000_000)] // 50 MB sınır
        [RequestFormLimits(MultipartBodyLengthLimit = 50_000_000)]
        public async Task<IActionResult> UploadModel([FromForm] string title, [FromForm] string? description, IFormFile file)
        {
            if (string.IsNullOrWhiteSpace(title) || title.Trim().Length > 100)
                return BadRequest(new { message = "Başlık boş olamaz ve en fazla 100 karakter olabilir." });

            if (description != null && description.Length > 500)
                return BadRequest(new { message = "Açıklama en fazla 500 karakter olabilir." });

            if (file == null || file.Length == 0)
                return BadRequest(new { message = "Lütfen bir STL dosyası seçin." });

            if (file.Length > 50_000_000)
                return BadRequest(new { message = "Dosya boyutu en fazla 50 MB olabilir." });

            if (!file.FileName.EndsWith(".stl", StringComparison.OrdinalIgnoreCase))
                return BadRequest(new { message = "Sadece .stl uzantılı dosyalar kabul edilir." });

            if (!await IsValidStlFileAsync(file))
                return BadRequest(new { message = "Geçersiz STL dosya içeriği." });

            var userId = User.GetRequiredUserId();
            var username = User.FindFirst(System.Security.Claims.ClaimTypes.Name)?.Value ?? "Bilinmeyen";

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
                Title = title.Trim(), // Kullanıcının girdiği orijinal isim başlıkta saklanır
                Description = string.IsNullOrWhiteSpace(description) ? null : description.Trim(),
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

            return Ok(new PrintModelDto
            {
                Id = printModel.Id,
                Title = printModel.Title,
                Description = printModel.Description,
                FileName = printModel.FileName,
                FileUrl = relativeFilePath,
                UploadedAt = printModel.UploadedAt,
                Uploader = username
            });
        }

        // DELETE: api/printmodels/{id}
        [HttpDelete("{id}")]
        [Authorize]
        [CheckBanned]
        public async Task<IActionResult> DeleteModel(int id)
        {
            var userId = User.GetRequiredUserId();

            var model = await _context.PrintModels.FirstOrDefaultAsync(m => m.Id == id);
            if (model == null)
                return NotFound(new { message = "Model bulunamadı." });

            var currentUser = await _context.Users.FindAsync(userId);
            bool isOwnerOrAdmin = currentUser != null && (currentUser.Role == "Owner" || currentUser.Role == "Admin");
            if (model.UserId != userId && !isOwnerOrAdmin)
                return StatusCode(StatusCodes.Status403Forbidden, new { message = "Bu modeli silme yetkiniz yok." });

            _context.PrintModels.Remove(model);
            await _context.SaveChangesAsync();

            var uploadsFolder = Path.Combine(_env.WebRootPath ?? Path.Combine(Directory.GetCurrentDirectory(), "wwwroot"), "uploads", "stl");
            var safeName = Path.GetFileName(model.FileName);
            if (!string.IsNullOrEmpty(safeName))
            {
                var absoluteFilePath = Path.Combine(uploadsFolder, safeName);
                if (System.IO.File.Exists(absoluteFilePath))
                {
                    try { System.IO.File.Delete(absoluteFilePath); } catch { /* ignore file lock errors */ }
                }
            }

            return Ok(new { message = "Model başarıyla silindi." });
        }

        private static async Task<bool> IsValidStlFileAsync(IFormFile file)
        {
            if (file.Length < 15) return false;

            var targetLen = (int)Math.Min(256, file.Length);
            var buffer = new byte[targetLen];
            await using var stream = file.OpenReadStream();
            int totalRead = 0;
            while (totalRead < targetLen)
            {
                var read = await stream.ReadAsync(buffer.AsMemory(totalRead, targetLen - totalRead));
                if (read == 0) break;
                totalRead += read;
            }
            if (totalRead < 15) return false;

            // PE (.exe/.dll) imzası ("MZ") kontrolü
            if (buffer[0] == 0x4D && buffer[1] == 0x5A) return false;

            var headAscii = Encoding.ASCII.GetString(buffer, 0, totalRead).TrimStart();
            // HTML / Script / XML / PHP içeriklerini reddet
            if (headAscii.StartsWith("<", StringComparison.Ordinal)) return false;

            // ASCII STL "solid" ile başlar; Binary STL ise en az 84 bayttır (80 bayt başlık + 4 bayt üçgen sayısı)
            bool isAsciiStl = headAscii.StartsWith("solid", StringComparison.OrdinalIgnoreCase);
            if (!isAsciiStl && file.Length < 84) return false;

            return true;
        }
    }
}
