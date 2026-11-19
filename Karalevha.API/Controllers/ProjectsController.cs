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
        private readonly IFileStore _store;
        private readonly NotificationService _notifications;

        public ProjectsController(AppDbContext context, CurrentUser current, IFileStore store, NotificationService notifications)
        {
            _notifications = notifications;
            _context = context;
            _current = current;
            _store = store;
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
                // Ekip: sahip dışındaki üyeler (istemci düzenleme yetkisi ve "benimkiler" için)
                MemberIds = _context.ProjectMembers.Where(m => m.ProjectId == p.Id).Select(m => m.UserId).ToList(),
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
            // Eski sürümlerin dosyaları da (kayıtları cascade ile gider)
            var versions = await _context.FileVersions
                .Where(v => (v.ProjectFileId != null && v.ProjectFile!.ProjectId == id) || (v.PrintModelId != null && v.PrintModel!.ProjectId == id))
                .Select(v => v.FilePath).ToListAsync();

            var commentIds = await _context.Comments.Where(c =>
                (c.TargetType == "project" && c.TargetId == id) || (c.TargetType == "model" && modelIds.Contains(c.TargetId)))
                .Select(c => c.Id).ToListAsync();
            _context.Projects.Remove(project);
            _context.Likes.RemoveRange(_context.Likes.Where(l =>
                (l.TargetType == "project" && l.TargetId == id) || (l.TargetType == "model" && modelIds.Contains(l.TargetId)) || (l.TargetType == "comment" && commentIds.Contains(l.TargetId))));
            _context.Comments.RemoveRange(_context.Comments.Where(c =>
                (c.TargetType == "project" && c.TargetId == id) || (c.TargetType == "model" && modelIds.Contains(c.TargetId))));
            await _context.SaveChangesAsync();

            await UploadFiles.DeleteAsync(_store, models.Select(m => m.FilePath).Concat(makePhotos).Concat(files).Concat(versions));
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
            f.Version,
            f.VersionNote,
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
            if (!await ProjectTeam.IsTeamAsync(_context, id, userId)) return StatusCode(403, new { message = "Bu projeye yalnızca ekibi dosya ekleyebilir." });

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

            // Depoda yalnızca GUID adı: yol saldırıları ve ad çakışması olmasın
            var stored = $"{Guid.NewGuid()}{extension.ToLowerInvariant()}";
            await using (var upload = file.OpenReadStream())
                await _store.SaveAsync($"uploads/projeler/{stored}", upload, contentType);

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
                await _store.DeleteAsync($"uploads/projeler/{stored}");
                throw;
            }
            return Ok(FileDto(entry, CurrentUser.NameOf(User)));
        }

        // DELETE: api/projects/{id}/dosyalar/{fileId}   (yükleyen, proje sahibi ya da yönetici)
        [HttpDelete("{id:int}/dosyalar/{fileId:int}")]
        [Authorize]
        public async Task<IActionResult> DeleteFile(int id, int fileId)
        {
            var entry = await _context.ProjectFiles.Include(f => f.Project).FirstOrDefaultAsync(f => f.Id == fileId && f.ProjectId == id);
            if (entry?.Project == null) return NotFound(new { message = "Dosya bulunamadı." });
            if (CurrentUser.IdOf(User) != entry.UserId && !_current.CanManage(User, entry.Project.UserId))
                return StatusCode(403, new { message = "Bu dosyayı silemezsin." });

            var versions = await _context.FileVersions.Where(v => v.ProjectFileId == fileId).Select(v => v.FilePath).ToListAsync();
            _context.ProjectFiles.Remove(entry);
            await _context.SaveChangesAsync();
            await UploadFiles.DeleteAsync(_store, versions.Append(entry.FilePath));
            return Ok(new { success = true });
        }

        // ------------------------------------------------------------ Sürümler

        // POST: api/projects/{id}/dosyalar/{fileId}/surum   (multipart: file, note?) — ekip
        // O anki dosya sürüm geçmişine taşınır, yenisi onun yerini alır (bağlantılar ve yorumlar aynı kalır).
        [HttpPost("{id:int}/dosyalar/{fileId:int}/surum")]
        [Authorize]
        [EnableRateLimiting("PartUploadLimiter")]
        [RequestSizeLimit(MaxFileSize + 1_000_000)]
        [RequestFormLimits(MultipartBodyLengthLimit = MaxFileSize + 1_000_000)]
        public async Task<IActionResult> UploadFileVersion(int id, int fileId, IFormFile file, [FromForm] string? note)
        {
            var entry = await _context.ProjectFiles.FirstOrDefaultAsync(f => f.Id == fileId && f.ProjectId == id);
            if (entry == null) return NotFound(new { message = "Dosya bulunamadı." });
            var userId = CurrentUser.IdOf(User)!.Value;
            if (!await ProjectTeam.IsTeamAsync(_context, id, userId)) return StatusCode(403, new { message = "Yeni sürümü yalnızca proje ekibi yükleyebilir." });
            if (file == null || file.Length == 0) return BadRequest(new { message = "Bir dosya seç." });
            if (file.Length > MaxFileSize) return BadRequest(new { message = "Dosya en fazla 25 MB olabilir." });
            var extension = Path.GetExtension(file.FileName);
            if (!ProjectFileTypes.Allows(entry.Kind, extension)) return BadRequest(new { message = "Bu dosya türü bu bölüme eklenemez." });
            note = string.IsNullOrWhiteSpace(note) ? null : note.Trim();
            if (note?.Length > 300) return BadRequest(new { message = "Not en fazla 300 karakter olabilir." });

            var stored = $"{Guid.NewGuid()}{extension.ToLowerInvariant()}";
            await using (var upload = file.OpenReadStream())
                await _store.SaveAsync($"uploads/projeler/{stored}", upload, ProjectFileTypes.ContentTypeOf(extension));

            _context.FileVersions.Add(new FileVersion
            {
                ProjectFileId = entry.Id, Version = entry.Version, FilePath = entry.FilePath, FileName = entry.FileName,
                Size = entry.Size, UserId = entry.UserId, Note = entry.VersionNote, CreatedAt = entry.UploadedAt,
            });
            var original = Path.GetFileName(file.FileName);
            entry.FilePath = $"/uploads/projeler/{stored}";
            entry.FileName = original.Length > 255 ? original[^255..] : original;
            entry.ContentType = ProjectFileTypes.ContentTypeOf(extension);
            entry.Size = file.Length;
            entry.UserId = userId;
            entry.UploadedAt = DateTime.UtcNow;
            entry.Version += 1;
            entry.VersionNote = note;
            try
            {
                await _context.SaveChangesAsync();
            }
            catch
            {
                await _store.DeleteAsync($"uploads/projeler/{stored}");
                throw;
            }
            return Ok(FileDto(entry, CurrentUser.NameOf(User)));
        }

        // GET: api/projects/{id}/dosyalar/{fileId}/surumler   — eski sürümler, yeniden eskiye
        [HttpGet("{id:int}/dosyalar/{fileId:int}/surumler")]
        public async Task<IActionResult> GetFileVersions(int id, int fileId)
        {
            if (!await _context.ProjectFiles.AnyAsync(f => f.Id == fileId && f.ProjectId == id)) return NotFound(new { message = "Dosya bulunamadı." });
            return Ok(await VersionList(_context.FileVersions.Where(v => v.ProjectFileId == fileId)));
        }

        internal static Task<List<VersionDto>> VersionList(IQueryable<FileVersion> query) =>
            query.AsNoTracking().OrderByDescending(v => v.Version)
                .Select(v => new VersionDto(v.Id, v.Version, v.FileName, v.FilePath, v.Size, v.Note, v.CreatedAt, v.User != null ? v.User.Username : null))
                .ToListAsync();

        public record VersionDto(int Id, int Version, string FileName, string FileUrl, long Size, string? Note, DateTime CreatedAt, string? Uploader);

        // ------------------------------------------------------------ Ekip

        // GET: api/projects/{id}/ekip   — sahip ve üyeler
        [HttpGet("{id:int}/ekip")]
        public async Task<IActionResult> GetTeam(int id)
        {
            var owner = await _context.Projects.AsNoTracking().Where(p => p.Id == id)
                .Select(p => new { UserId = p.UserId, p.User!.Username }).FirstOrDefaultAsync();
            if (owner == null) return NotFound(new { message = "Proje bulunamadı" });
            var members = await _context.ProjectMembers.AsNoTracking().Where(m => m.ProjectId == id).OrderBy(m => m.AddedAt)
                .Select(m => new { m.UserId, m.User!.Username, m.AddedAt }).ToListAsync();
            return Ok(new[] { new { owner.UserId, owner.Username, Role = "sahip", AddedAt = (DateTime?)null } }
                .Concat(members.Select(m => new { m.UserId, m.Username, Role = "uye", AddedAt = (DateTime?)m.AddedAt })));
        }

        public class AddMemberDto
        {
            public string Username { get; set; } = string.Empty;
        }

        private const int MaxMembers = 20;

        // POST: api/projects/{id}/ekip   — sahip üye ekler
        [HttpPost("{id:int}/ekip")]
        [Authorize]
        public async Task<IActionResult> AddMember(int id, AddMemberDto dto)
        {
            var project = await _context.Projects.FindAsync(id);
            if (project == null) return NotFound(new { message = "Proje bulunamadı" });
            if (CurrentUser.IdOf(User) != project.UserId) return StatusCode(403, new { message = "Ekibi yalnızca proje sahibi yönetir." });

            var name = (dto.Username ?? string.Empty).Trim().TrimStart('@').ToLowerInvariant();
            var user = await _context.Users.FirstOrDefaultAsync(u => u.NormalizedUsername == name);
            if (user == null) return NotFound(new { message = "Bu kullanıcı adıyla kimse yok." });
            if (user.Id == project.UserId) return BadRequest(new { message = "Proje sahibi zaten ekipte." });
            if (await _context.ProjectMembers.AnyAsync(m => m.ProjectId == id && m.UserId == user.Id)) return BadRequest(new { message = $"{user.Username} zaten ekipte." });
            if (await _context.ProjectMembers.CountAsync(m => m.ProjectId == id) >= MaxMembers) return BadRequest(new { message = $"Bir projede en fazla {MaxMembers} üye olabilir." });

            _context.ProjectMembers.Add(new ProjectMember { ProjectId = id, UserId = user.Id });
            _notifications.Add(user.Id, project.UserId, $"{CurrentUser.NameOf(User)} seni \"{project.Title}\" projesinin ekibine ekledi.", $"/projeler/{id}");
            await _context.SaveChangesAsync();
            return Ok(new { user.Id, user.Username });
        }

        // DELETE: api/projects/{id}/ekip/{userId}   — sahip çıkarır ya da üye kendisi ayrılır
        [HttpDelete("{id:int}/ekip/{userId:int}")]
        [Authorize]
        public async Task<IActionResult> RemoveMember(int id, int userId)
        {
            var project = await _context.Projects.AsNoTracking().FirstOrDefaultAsync(p => p.Id == id);
            if (project == null) return NotFound(new { message = "Proje bulunamadı" });
            var me = CurrentUser.IdOf(User);
            if (me != project.UserId && me != userId) return StatusCode(403, new { message = "Bu kişiyi ekipten çıkaramazsın." });
            var member = await _context.ProjectMembers.FirstOrDefaultAsync(m => m.ProjectId == id && m.UserId == userId);
            if (member == null) return NotFound(new { message = "Bu kişi ekipte değil." });
            _context.ProjectMembers.Remove(member);
            await _context.SaveChangesAsync();
            return Ok(new { success = true });
        }
    }
}
