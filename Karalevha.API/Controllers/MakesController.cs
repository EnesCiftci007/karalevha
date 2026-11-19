using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Karalevha.API.Data;
using Karalevha.API.Models;
using Karalevha.API.Services;

namespace Karalevha.API.Controllers
{
    /// <summary>"Bunu bastım": bir modelin basılmış hâlinin fotoğrafı ve baskı ayarları.</summary>
    [Route("api/bastim")]
    [ApiController]
    public class MakesController : ControllerBase
    {
        private const long MaxPhotoSize = 8 * 1024 * 1024; // 8 MB

        // Fotoğraf türü uzantıdan değil dosyanın ilk baytlarından anlaşılır
        private static readonly (string Ext, byte[] Magic)[] ImageSignatures =
        {
            (".jpg", new byte[] { 0xFF, 0xD8, 0xFF }),
            (".png", new byte[] { 0x89, 0x50, 0x4E, 0x47 }),
            (".webp", new byte[] { 0x52, 0x49, 0x46, 0x46 }), // RIFF....WEBP
        };

        private readonly AppDbContext _context;
        private readonly IFileStore _store;
        private readonly CurrentUser _current;
        private readonly NotificationService _notifications;

        public MakesController(AppDbContext context, IFileStore store, CurrentUser current, NotificationService notifications)
        {
            _context = context;
            _store = store;
            _current = current;
            _notifications = notifications;
        }


        // GET: api/bastim/model/{modelId}
        [HttpGet("model/{modelId:int}")]
        public async Task<IActionResult> GetForModel(int modelId)
        {
            var makes = await _context.PrintMakes.AsNoTracking()
                .Where(m => m.PrintModelId == modelId)
                .OrderByDescending(m => m.CreatedAt)
                .Select(m => new { m.Id, m.PrintModelId, m.PhotoPath, m.Note, m.Settings, m.CreatedAt, m.UserId, Username = m.User!.Username })
                .ToListAsync();
            return Ok(makes);
        }

        // POST: api/bastim/model/{modelId}  (multipart: photo, note?, settings?)
        [HttpPost("model/{modelId:int}")]
        [Authorize]
        [EnableRateLimiting("UploadLimiter")]
        [RequestSizeLimit(MaxPhotoSize + 100_000)]
        [RequestFormLimits(MultipartBodyLengthLimit = MaxPhotoSize + 100_000)]
        public async Task<IActionResult> Create(int modelId, IFormFile? photo, [FromForm] string? note, [FromForm] string? settings)
        {
            var userId = CurrentUser.IdOf(User);
            if (userId == null) return Unauthorized();

            var model = await _context.PrintModels.FindAsync(modelId);
            if (model == null) return NotFound(new { message = "Model bulunamadı." });

            if (photo == null || photo.Length == 0) return BadRequest(new { message = "Bir fotoğraf seç." });
            if (photo.Length > MaxPhotoSize) return BadRequest(new { message = "Fotoğraf en fazla 8 MB olabilir." });

            var header = new byte[12];
            await using (var head = photo.OpenReadStream())
                _ = await head.ReadAtLeastAsync(header, header.Length, throwOnEndOfStream: false);
            var ext = ImageSignatures.FirstOrDefault(sig => header.Take(sig.Magic.Length).SequenceEqual(sig.Magic)).Ext;
            if (ext == ".webp" && !(header[8] == 'W' && header[9] == 'E' && header[10] == 'B' && header[11] == 'P')) ext = null;
            if (ext == null) return BadRequest(new { message = "Fotoğraf JPG, PNG ya da WebP olmalı." });

            note = string.IsNullOrWhiteSpace(note) ? null : note.Trim();
            settings = string.IsNullOrWhiteSpace(settings) ? null : settings.Trim();
            if (note?.Length > 500) return BadRequest(new { message = "Not en fazla 500 karakter olabilir." });
            if (settings?.Length > 300) return BadRequest(new { message = "Ayarlar en fazla 300 karakter olabilir." });

            var fileName = $"{Guid.NewGuid()}{ext}";
            var key = $"uploads/makes/{fileName}";
            await using (var upload = photo.OpenReadStream())
                await _store.SaveAsync(key, upload, ext == ".png" ? "image/png" : ext == ".webp" ? "image/webp" : "image/jpeg");

            var make = new PrintMake
            {
                PrintModelId = modelId,
                UserId = userId.Value,
                PhotoPath = $"/uploads/makes/{fileName}",
                Note = note,
                Settings = settings
            };
            _context.PrintMakes.Add(make);
            _notifications.Add(model.UserId, userId, $"{CurrentUser.NameOf(User)} \"{model.Title}\" modelini bastı ve fotoğrafını paylaştı.", $"/model/{modelId}");

            try
            {
                await _context.SaveChangesAsync();
            }
            catch
            {
                await _store.DeleteAsync(key);
                throw;
            }

            return Ok(new { make.Id, make.PrintModelId, make.PhotoPath, make.Note, make.Settings, make.CreatedAt, make.UserId, Username = CurrentUser.NameOf(User) });
        }

        // DELETE: api/bastim/{id}
        [HttpDelete("{id:int}")]
        [Authorize]
        public async Task<IActionResult> Delete(int id)
        {
            var make = await _context.PrintMakes.FindAsync(id);
            if (make == null) return NotFound(new { message = "Fotoğraf bulunamadı." });
            if (!_current.CanManage(User, make.UserId)) return StatusCode(403, new { message = "Bu fotoğrafı silemezsin." });

            _context.PrintMakes.Remove(make);
            await _context.SaveChangesAsync();

            await UploadFiles.DeleteAsync(_store, new[] { make.PhotoPath });

            return Ok(new { success = true });
        }
    }
}
