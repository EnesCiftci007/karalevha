using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Karalevha.API.Data;
using Karalevha.API.Models;
using System.Security.Claims;
using Microsoft.AspNetCore.RateLimiting;
using Karalevha.API.Services;

namespace Karalevha.API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class PrintModelsController : ControllerBase
    {
        private const long MaxFileSize = 50_000_000; // 50 MB

        // Tek dosyadan oluşan 3B biçimler. .gltf kabul edilmez: dokuları ve verisi ayrı dosyalarda durur.
        private static readonly HashSet<string> AllowedExtensions = new(StringComparer.OrdinalIgnoreCase)
        {
            ".stl", ".3mf", ".obj", ".fbx", ".glb"
        };

        private static readonly HashSet<string> Categories = new() { "baski", "oyun" };

        private readonly AppDbContext _context;
        private readonly IFileStore _store;
        private readonly CurrentUser _current;

        public PrintModelsController(AppDbContext context, IFileStore store, CurrentUser current)
        {
            _context = context;
            _store = store;
            _current = current;
        }


        public class UpdateModelDto
        {
            public string Title { get; set; } = string.Empty;
            public string? Description { get; set; }
            public string Category { get; set; } = "baski";
        }

        // PUT: api/printmodels/{id}
        [HttpPut("{id:int}")]
        [Authorize]
        public async Task<IActionResult> UpdateModel(int id, UpdateModelDto dto)
        {
            var model = await _context.PrintModels.FindAsync(id);
            if (model == null) return NotFound(new { message = "Model bulunamadı." });
            // Yükleyen ya da projenin sahibi düzenler
            if (CurrentUser.IdOf(User) != model.UserId && !(model.ProjectId is { } pid && await ProjectTeam.IsOwnerAsync(_context, pid, CurrentUser.IdOf(User))))
                return StatusCode(403, new { message = "Bu modeli düzenleyemezsin." });

            var title = dto.Title?.Trim() ?? string.Empty;
            if (title.Length == 0 || title.Length > 100) return BadRequest(new { message = "Model adı 1-100 karakter olmalı." });
            var description = string.IsNullOrWhiteSpace(dto.Description) ? null : dto.Description.Trim();
            if (description?.Length > 500) return BadRequest(new { message = "Açıklama en fazla 500 karakter olabilir." });
            if (!Categories.Contains(dto.Category)) return BadRequest(new { message = "Geçersiz kategori." });

            model.Title = title;
            model.Description = description;
            model.Category = dto.Category;
            await _context.SaveChangesAsync();
            return Ok(new { success = true });
        }

        // DELETE: api/printmodels/{id}
        [HttpDelete("{id:int}")]
        [Authorize]
        public async Task<IActionResult> DeleteModel(int id)
        {
            var model = await _context.PrintModels.FindAsync(id);
            if (model == null) return NotFound(new { message = "Model bulunamadı." });
            // Yükleyen, projenin sahibi ya da yönetici siler
            if (!_current.CanManage(User, model.UserId) && !(model.ProjectId is { } pid && await ProjectTeam.IsOwnerAsync(_context, pid, CurrentUser.IdOf(User))))
                return StatusCode(403, new { message = "Bu modeli silemezsin." });

            // "Bunu bastım" fotoğrafları ve eski sürümler kayıtla birlikte (cascade) silinir; dosyalarını önceden topla
            var makePhotos = await _context.PrintMakes.Where(m => m.PrintModelId == id).Select(m => m.PhotoPath).ToListAsync();
            var versions = await _context.FileVersions.Where(v => v.PrintModelId == id).Select(v => v.FilePath).ToListAsync();

            var commentIds = await _context.Comments.Where(c => c.TargetType == "model" && c.TargetId == id).Select(c => c.Id).ToListAsync();
            _context.PrintModels.Remove(model);
            _context.Likes.RemoveRange(_context.Likes.Where(l =>
                (l.TargetType == "model" && l.TargetId == id) || (l.TargetType == "comment" && commentIds.Contains(l.TargetId))));
            _context.Comments.RemoveRange(_context.Comments.Where(c => c.TargetType == "model" && c.TargetId == id));
            await _context.SaveChangesAsync();

            // Kayıt silindikten sonra dosyaları da kaldır (yalnızca /uploads altındaki geçerli yollar)
            await UploadFiles.DeleteAsync(_store, makePhotos.Concat(versions).Append(model.FilePath));

            return Ok(new { success = true });
        }

        // POST: api/printmodels/{id}/surum   (multipart: file, note?) — proje ekibi
        // O anki model sürüm geçmişine taşınır; beğeniler, yorumlar ve baskı fotoğrafları yeni sürümde kalır.
        [HttpPost("{id:int}/surum")]
        [Authorize]
        [EnableRateLimiting("PartUploadLimiter")]
        [RequestSizeLimit(MaxFileSize + 1_000_000)]
        [RequestFormLimits(MultipartBodyLengthLimit = MaxFileSize + 1_000_000)]
        public async Task<IActionResult> UploadVersion(int id, IFormFile file, [FromForm] string? note)
        {
            var model = await _context.PrintModels.FindAsync(id);
            if (model == null) return NotFound(new { message = "Model bulunamadı." });
            var userId = CurrentUser.IdOf(User)!.Value;
            var allowed = model.ProjectId is { } pid ? await ProjectTeam.IsTeamAsync(_context, pid, userId) : model.UserId == userId;
            if (!allowed) return StatusCode(403, new { message = "Yeni sürümü yalnızca proje ekibi yükleyebilir." });
            if (file == null || file.Length == 0) return BadRequest(new { message = "Lütfen bir model dosyası seçin." });
            if (file.Length > MaxFileSize) return BadRequest(new { message = "Dosya en fazla 50 MB olabilir." });
            var extension = Path.GetExtension(file.FileName).ToLowerInvariant();
            if (!AllowedExtensions.Contains(extension)) return BadRequest(new { message = "Desteklenen biçimler: STL, 3MF, OBJ, FBX, GLB." });
            note = string.IsNullOrWhiteSpace(note) ? null : note.Trim();
            if (note?.Length > 300) return BadRequest(new { message = "Not en fazla 300 karakter olabilir." });

            var safeFileName = $"{Guid.NewGuid()}{extension}";
            await using (var upload = file.OpenReadStream())
                await _store.SaveAsync($"uploads/models/{safeFileName}", upload, "application/octet-stream");

            var oldKey = FileKeys.FromPublicPath(model.FilePath);
            var size = oldKey != null ? await _store.GetLengthAsync(oldKey, HttpContext.RequestAborted) ?? 0 : 0;
            _context.FileVersions.Add(new FileVersion
            {
                PrintModelId = model.Id, Version = model.Version, FilePath = model.FilePath,
                // Modelin diskteki adı GUID; sürüm listesinde modelin adı ve uzantısı görünsün
                FileName = $"{model.Title}{Path.GetExtension(model.FileName).ToLowerInvariant()}",
                Size = size, UserId = model.UserId, Note = model.VersionNote, CreatedAt = model.UploadedAt,
            });
            model.FilePath = $"/uploads/models/{safeFileName}";
            model.FileName = safeFileName;
            model.UserId = userId;
            model.UploadedAt = DateTime.UtcNow;
            model.Version += 1;
            model.VersionNote = note;
            try
            {
                await _context.SaveChangesAsync();
            }
            catch
            {
                await _store.DeleteAsync($"uploads/models/{safeFileName}");
                throw;
            }
            return Ok(new { model.Id, model.Version, FileUrl = model.FilePath, Format = extension.TrimStart('.') });
        }

        private static async Task<long> DisposeAndLength(StoredFile file)
        {
            await file.Content.DisposeAsync();
            return file.Length ?? 0;
        }

        // GET: api/printmodels/{id}/surumler   — eski sürümler, yeniden eskiye
        [HttpGet("{id:int}/surumler")]
        public async Task<IActionResult> GetVersions(int id)
        {
            if (!await _context.PrintModels.AnyAsync(m => m.Id == id)) return NotFound(new { message = "Model bulunamadı." });
            return Ok(await ProjectsController.VersionList(_context.FileVersions.Where(v => v.PrintModelId == id)));
        }

        // GET: api/printmodels/{id}   — tek model (eski /baski-istasyonu?model= bağlantılarını projeye yönlendirmek için)
        [HttpGet("{id:int}")]
        public async Task<IActionResult> GetModel(int id)
        {
            var model = await _context.PrintModels.AsNoTracking().Where(m => m.Id == id)
                .Select(m => new { m.Id, m.Title, m.ProjectId }).FirstOrDefaultAsync();
            return model == null ? NotFound(new { message = "Model bulunamadı." }) : Ok(model);
        }

        // GET: api/printmodels?projectId=3&category=oyun
        [HttpGet]
        public async Task<IActionResult> GetModels([FromQuery] int skip = 0, [FromQuery] int take = 50, [FromQuery] string? category = null, [FromQuery] int? projectId = null)
        {
            skip = Math.Max(skip, 0);
            take = Math.Clamp(take, 1, 100);

            var query = _context.PrintModels.AsNoTracking();
            if (!string.IsNullOrEmpty(category) && Categories.Contains(category))
                query = query.Where(m => m.Category == category);
            if (projectId != null)
                query = query.Where(m => m.ProjectId == projectId);

            var models = await query
                .OrderByDescending(m => m.UploadedAt)
                .Skip(skip)
                .Take(take)
                .Select(m => new
                {
                    m.Id,
                    m.Title,
                    m.Description,
                    m.FileName,
                    // Eski kayıtların FilePath'i de /uploads/stl/... biçiminde; doğrudan kullanılabilir
                    FileUrl = m.FilePath,
                    m.Category,
                    m.UploadedAt,
                    m.UserId,
                    Uploader = m.User!.Username,
                    m.ProjectId,
                    ProjectTitle = m.Project != null ? m.Project.Title : null,
                    m.Version,
                    m.VersionNote,
                })
                .ToListAsync();

            return Ok(models.Select(m => new
            {
                m.Id,
                m.Title,
                m.Description,
                m.FileName,
                m.FileUrl,
                m.Category,
                Format = Path.GetExtension(m.FileName).TrimStart('.').ToLowerInvariant(),
                m.UploadedAt,
                m.UserId,
                m.Uploader,
                m.ProjectId,
                m.ProjectTitle,
                m.Version,
                m.VersionNote,
            }));
        }

        // POST: api/printmodels
        [HttpPost]
        [Authorize]
        [EnableRateLimiting("PartUploadLimiter")]
        [RequestSizeLimit(MaxFileSize + 1_000_000)]
        [RequestFormLimits(MultipartBodyLengthLimit = MaxFileSize + 1_000_000)]
        public async Task<IActionResult> UploadModel([FromForm] string title, [FromForm] string? description, [FromForm] string? category, [FromForm] int? projectId, IFormFile file)
        {
            // Modeller projelerin içinde durur: proje zorunlu ve yalnızca sahibi ekler
            if (projectId == null) return BadRequest(new { message = "Model bir projeye eklenmeli." });
            var project = await _context.Projects.AsNoTracking().FirstOrDefaultAsync(p => p.Id == projectId);
            if (project == null) return NotFound(new { message = "Proje bulunamadı." });
            if (!await ProjectTeam.IsTeamAsync(_context, project.Id, CurrentUser.IdOf(User))) return StatusCode(403, new { message = "Bu projeye yalnızca ekibi model ekleyebilir." });

            if (file == null || file.Length == 0)
                return BadRequest(new { message = "Lütfen bir model dosyası seçin." });

            if (file.Length > MaxFileSize)
                return BadRequest(new { message = "Dosya en fazla 50 MB olabilir." });

            var extension = Path.GetExtension(file.FileName).ToLowerInvariant();
            if (!AllowedExtensions.Contains(extension))
                return BadRequest(new { message = "Desteklenen biçimler: STL, 3MF, OBJ, FBX, GLB." });

            title = title?.Trim() ?? string.Empty;
            if (title.Length == 0 || title.Length > 100)
                return BadRequest(new { message = "Model adı 1-100 karakter olmalı." });

            description = string.IsNullOrWhiteSpace(description) ? null : description.Trim();
            if (description?.Length > 500)
                return BadRequest(new { message = "Açıklama en fazla 500 karakter olabilir." });

            category = string.IsNullOrEmpty(category) ? "baski" : category;
            if (!Categories.Contains(category))
                return BadRequest(new { message = "Geçersiz kategori." });

            if (!int.TryParse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value, out var userId))
                return Unauthorized();

            // Dosya ismi zafiyetlerini (Path Traversal) ve URL bozulmalarını önlemek için sadece GUID kullan
            var safeFileName = $"{Guid.NewGuid()}{extension}";
            await using (var upload = file.OpenReadStream())
                await _store.SaveAsync($"uploads/models/{safeFileName}", upload, "application/octet-stream");

            var printModel = new PrintModel
            {
                Title = title,
                Description = description,
                FilePath = $"/uploads/models/{safeFileName}", // Veritabanına mutlak (C:\...) yol yazılmaz
                FileName = safeFileName,
                Category = category,
                UserId = userId,
                ProjectId = projectId,
                UploadedAt = DateTime.UtcNow
            };

            try
            {
                _context.PrintModels.Add(printModel);
                await _context.SaveChangesAsync();
            }
            catch
            {
                // DB'ye yazılamazsa çöp dosyayı depodan sil
                await _store.DeleteAsync($"uploads/models/{safeFileName}");
                throw;
            }

            return Ok(new { message = "Model yüklendi.", printModel.Id });
        }
    }
}
