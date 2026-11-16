using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Karalevha.API.Data;
using Karalevha.API.Models;
using Karalevha.API.DTOs;
using Karalevha.API.Services;

namespace Karalevha.API.Controllers
{
    /// <summary>
    /// Projeler. Bir proje üç bölümden oluşur: Yazılım (isteğe bağlı GitHub/GitLab deposu, CodeController),
    /// Modeller (3B modeller, PrintModelsController ?projectId=) ve Çizimler (şema, çizim, belge; bu controller).
    /// </summary>
    [Route("api/[controller]")]
    [ApiController]
    public class ProjectsController : ControllerBase
    {
        private const long MaxFileSize = 25_000_000; // 25 MB


        private readonly AppDbContext _context;
        private readonly CurrentUser _current;
        private readonly IWebHostEnvironment _env;

        public ProjectsController(AppDbContext context, CurrentUser current, IWebHostEnvironment env)
        {
            _context = context;
            _current = current;
            _env = env;
        }

        /// <summary>Projelerin dalları; Projeler sayfasındaki süzgeçle aynı sırada</summary>
        public static readonly string[] Categories = { "robotik", "elektronik", "yazilim", "tasarim", "diger" };

        private IQueryable<object> Project(IQueryable<Project> query) =>
            query.Select(p => new
            {
                p.Id,
                p.Title,
                p.Description,
                p.RepoUrl,
                p.Category,
                p.Stars,
                p.Forks,
                p.CreatedAt,
                p.UserId,
                Owner = p.User!.Username,
                ModelCount = _context.PrintModels.Count(m => m.ProjectId == p.Id),
                FileCount = _context.ProjectFiles.Count(f => f.ProjectId == p.Id),
                DrawingCount = _context.ProjectFiles.Count(f => f.ProjectId == p.Id && f.Kind == ProjectFileTypes.Drawing),
                ElectronicsCount = _context.ProjectFiles.Count(f => f.ProjectId == p.Id && f.Kind == ProjectFileTypes.Electronics),
                CodeFileCount = _context.ProjectFiles.Count(f => f.ProjectId == p.Id && f.Kind == ProjectFileTypes.Code),
                // Listede projenin önizlemesi: ilk 3B modeli
                Cover = _context.PrintModels.Where(m => m.ProjectId == p.Id).OrderBy(m => m.Id)
                    .Select(m => new { m.Id, FileUrl = m.FilePath, m.FileName }).FirstOrDefault(),
            });

        private static bool IsWebUrl(string url) =>
            Uri.TryCreate(url, UriKind.Absolute, out var uri) && (uri.Scheme == Uri.UriSchemeHttps || uri.Scheme == Uri.UriSchemeHttp);

        /// <summary>Başlık, açıklama ve (varsa) depo adresi. Hata varsa mesajı döner.</summary>
        private static string? Validate(CreateProjectDto dto, out string repo)
        {
            repo = dto.RepoUrl?.Trim() ?? string.Empty;
            if (string.IsNullOrWhiteSpace(dto.Title)) return "Proje adı boş olamaz.";
            if (string.IsNullOrWhiteSpace(dto.Description)) return "Kısa bir açıklama yaz.";
            if (repo.Length > 0 && !IsWebUrl(repo)) return "Depo adresi http(s) ile başlamalı.";
            if (dto.Category != null && !Categories.Contains(dto.Category)) return "Geçersiz proje dalı.";
            return null;
        }

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
            if (Validate(dto, out var repo) is { } error) return BadRequest(new { message = error });

            var project = new Project
            {
                Title = dto.Title.Trim(),
                Description = dto.Description.Trim(),
                RepoUrl = repo,
                Category = dto.Category ?? "diger",
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
            if (Validate(dto, out var repo) is { } error) return BadRequest(new { message = error });

            project.Title = dto.Title.Trim();
            project.Description = dto.Description.Trim();
            project.RepoUrl = repo;
            if (dto.Category != null) project.Category = dto.Category;
            await _context.SaveChangesAsync();

            return Ok(await Project(_context.Projects.Where(p => p.Id == id)).FirstAsync());
        }

        // DELETE: api/projects/{id}
        // Projenin modelleri, model fotoğrafları ve dosyaları da silinir (kayıtlar cascade, dosyalar burada).
        [HttpDelete("{id:int}")]
        [Authorize]
        public async Task<IActionResult> DeleteProject(int id)
        {
            var project = await _context.Projects.FindAsync(id);
            if (project == null) return NotFound(new { message = "Proje bulunamadı" });
            if (!_current.CanManage(User, project.UserId)) return StatusCode(403, new { message = "Bu projeyi silemezsin." });

            var models = await _context.PrintModels.Where(m => m.ProjectId == id).Select(m => new { m.Id, m.FilePath }).ToListAsync();
            var modelIds = models.Select(m => m.Id).ToList();
            var makePhotos = await _context.PrintMakes.Where(m => modelIds.Contains(m.PrintModelId)).Select(m => m.PhotoPath).ToListAsync();
            var files = await _context.ProjectFiles.Where(f => f.ProjectId == id).Select(f => f.FilePath).ToListAsync();

            _context.Projects.Remove(project);
            _context.Likes.RemoveRange(_context.Likes.Where(l =>
                (l.TargetType == "project" && l.TargetId == id) || (l.TargetType == "model" && modelIds.Contains(l.TargetId))));
            _context.Comments.RemoveRange(_context.Comments.Where(c =>
                (c.TargetType == "project" && c.TargetId == id) || (c.TargetType == "model" && modelIds.Contains(c.TargetId))));
            await _context.SaveChangesAsync();

            UploadFiles.Delete(_env, models.Select(m => m.FilePath).Concat(makePhotos).Concat(files));
            return Ok(new { success = true });
        }

        // ------------------------------------------------------------ Çizimler ve belgeler

        private static object FileDto(ProjectFile f, string uploader) => new
        {
            f.Id,
            f.Title,
            f.FileName,
            FileUrl = f.FilePath,
            f.ContentType,
            f.Kind,
            f.Size,
            f.UploadedAt,
            f.UserId,
            Uploader = uploader,
        };

        // GET: api/projects/dosya-turleri   — bölümlere göre eklenebilen uzantılar (istemcinin seçicisi için)
        [HttpGet("dosya-turleri")]
        public IActionResult GetFileTypes() => Ok(new
        {
            common = ProjectFileTypes.Common,
            cizim = ProjectFileTypes.DrawingTypes,
            elektronik = ProjectFileTypes.ElectronicsTypes,
            kod = ProjectFileTypes.CodeTypes,
        });

        // GET: api/projects/{id}/dosyalar
        [HttpGet("{id:int}/dosyalar")]
        public async Task<IActionResult> GetFiles(int id)
        {
            if (!await _context.Projects.AnyAsync(p => p.Id == id)) return NotFound(new { message = "Proje bulunamadı" });
            var files = await _context.ProjectFiles.AsNoTracking()
                .Where(f => f.ProjectId == id)
                .OrderByDescending(f => f.UploadedAt)
                .Select(f => new { File = f, Uploader = f.User!.Username })
                .ToListAsync();
            return Ok(files.Select(x => FileDto(x.File, x.Uploader)));
        }

        // POST: api/projects/{id}/dosyalar   (multipart: file, kind, title?)
        // Yalnızca proje sahibi ekler.
        [HttpPost("{id:int}/dosyalar")]
        [Authorize]
        [EnableRateLimiting("PartUploadLimiter")]
        [RequestSizeLimit(MaxFileSize + 1_000_000)]
        [RequestFormLimits(MultipartBodyLengthLimit = MaxFileSize + 1_000_000)]
        public async Task<IActionResult> UploadFile(int id, [FromForm] string? title, [FromForm] string? kind, IFormFile file)
        {
            var project = await _context.Projects.FindAsync(id);
            if (project == null) return NotFound(new { message = "Proje bulunamadı" });
            var userId = CurrentUser.IdOf(User)!.Value;
            if (userId != project.UserId) return StatusCode(403, new { message = "Bu projeye yalnızca sahibi dosya ekleyebilir." });

            if (file == null || file.Length == 0) return BadRequest(new { message = "Bir dosya seç." });
            if (file.Length > MaxFileSize) return BadRequest(new { message = "Dosya en fazla 25 MB olabilir." });

            // ".kicad_pcb" gibi çok parçalı uzantılar: son noktadan sonrası
            var extension = Path.GetExtension(file.FileName);
            kind = string.IsNullOrEmpty(kind) ? ProjectFileTypes.Drawing : kind;
            if (!ProjectFileTypes.Kinds.Contains(kind)) return BadRequest(new { message = "Geçersiz bölüm." });
            if (!ProjectFileTypes.Allows(kind, extension))
                return BadRequest(new { message = kind switch
                {
                    ProjectFileTypes.Electronics => "Elektronik bölümüne KiCad, Eagle, Altium, Fritzing, Proteus, LTspice, Gerber, görsel, PDF ya da ZIP eklenir.",
                    ProjectFileTypes.Code => "Kod bölümüne kaynak dosyalar (ör. .ino, .py, .cpp), görsel, PDF ya da ZIP eklenir.",
                    _ => "Çizimler bölümüne DXF, DWG, SVG, STEP, IGES, Fusion, SolidWorks, Inventor, FreeCAD, URDF, görsel, PDF ya da ZIP eklenir. 3B modeller Modeller bölümüne.",
                } });
            var contentType = ProjectFileTypes.ContentTypeOf(extension);

            var originalName = Path.GetFileName(file.FileName);
            var cleanTitle = string.IsNullOrWhiteSpace(title) ? Path.GetFileNameWithoutExtension(originalName) : title.Trim();
            if (cleanTitle.Length > 120) return BadRequest(new { message = "Başlık en fazla 120 karakter olabilir." });

            // Diskte yalnızca GUID adı: yol saldırıları ve ad çakışması olmasın
            var stored = $"{Guid.NewGuid()}{extension.ToLowerInvariant()}";
            var folder = Path.Combine(UploadFiles.WebRoot(_env), "uploads", "projeler");
            Directory.CreateDirectory(folder);
            var absolute = Path.Combine(folder, stored);
            await using (var stream = new FileStream(absolute, FileMode.CreateNew))
                await file.CopyToAsync(stream);

            var entry = new ProjectFile
            {
                ProjectId = id,
                UserId = userId,
                Title = cleanTitle,
                FileName = originalName.Length > 255 ? originalName[^255..] : originalName,
                FilePath = $"/uploads/projeler/{stored}",
                ContentType = contentType,
                Kind = kind,
                Size = file.Length,
                UploadedAt = DateTime.UtcNow,
            };
            try
            {
                _context.ProjectFiles.Add(entry);
                await _context.SaveChangesAsync();
            }
            catch
            {
                System.IO.File.Delete(absolute);
                throw;
            }
            return Ok(FileDto(entry, CurrentUser.NameOf(User)));
        }

        // DELETE: api/projects/{id}/dosyalar/{fileId}   (proje sahibi ya da yönetici)
        [HttpDelete("{id:int}/dosyalar/{fileId:int}")]
        [Authorize]
        public async Task<IActionResult> DeleteFile(int id, int fileId)
        {
            var entry = await _context.ProjectFiles.Include(f => f.Project).FirstOrDefaultAsync(f => f.Id == fileId && f.ProjectId == id);
            if (entry?.Project == null) return NotFound(new { message = "Dosya bulunamadı." });
            if (!_current.CanManage(User, entry.Project.UserId)) return StatusCode(403, new { message = "Bu dosyayı silemezsin." });

            _context.ProjectFiles.Remove(entry);
            await _context.SaveChangesAsync();
            UploadFiles.Delete(_env, new[] { entry.FilePath });
            return Ok(new { success = true });
        }
    }
}
