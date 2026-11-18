using System.Text;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.StaticFiles;
using Microsoft.EntityFrameworkCore;
using Karalevha.API.Data;
using Karalevha.API.Services;

namespace Karalevha.API.Controllers
{
    /// <summary>Projelerin kod görüntüleyicisi: depo ağacı, dosya içeriği ve ham dosya.</summary>
    [Route("api/projects/{id:int}/kod")]
    [ApiController]
    public class CodeController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly RepoService _repos;
        private static readonly FileExtensionContentTypeProvider ContentTypes = new();

        public CodeController(AppDbContext context, RepoService repos)
        {
            _context = context;
            _repos = repos;
        }

        private async Task<(RepoService.RepoRef? Repo, IActionResult? Error)> Resolve(int id)
        {
            var url = await _context.Projects.AsNoTracking().Where(p => p.Id == id).Select(p => p.RepoUrl).FirstOrDefaultAsync();
            if (url == null) return (null, NotFound(new { message = "Proje bulunamadı." }));
            var repo = RepoService.Parse(url);
            if (repo == null) return (null, UnprocessableEntity(new { message = "Kod görüntüleyici şimdilik yalnızca GitHub ve GitLab depolarını destekliyor." }));
            return (repo, null);
        }

        private ObjectResult Fail(RepoService.RepoException e) => StatusCode(e.Status, new { message = e.Message });

        // GET: api/projects/{id}/kod
        [HttpGet]
        public async Task<IActionResult> GetTree(int id, CancellationToken ct)
        {
            var (repo, error) = await Resolve(id);
            if (error != null) return error;
            try
            {
                var info = await _repos.GetInfo(repo!, ct);
                return Ok(info);
            }
            catch (RepoService.RepoException e)
            {
                return Fail(e);
            }
        }

        // GET: api/projects/{id}/kod/dosya?yol=src/main.cpp   — metin dosyası içeriği
        [HttpGet("dosya")]
        public async Task<IActionResult> GetFile(int id, [FromQuery] string yol, CancellationToken ct)
        {
            if (string.IsNullOrWhiteSpace(yol) || yol.Length > 500) return BadRequest(new { message = "Geçersiz dosya yolu." });
            var (repo, error) = await Resolve(id);
            if (error != null) return error;
            try
            {
                var bytes = await _repos.GetRaw(repo!, yol, RepoService.MaxTextBytes, ct);
                if (!RepoService.LooksLikeText(bytes))
                    return Ok(new { path = yol, kind = "binary", size = bytes.Length });
                var text = Encoding.UTF8.GetString(bytes);
                if (text.Length > 0 && text[0] == '﻿') text = text[1..]; // BOM
                return Ok(new { path = yol, kind = "text", size = bytes.Length, content = text });
            }
            catch (RepoService.RepoException e) when (e.Status == 413)
            {
                return Ok(new { path = yol, kind = "large" });
            }
            catch (RepoService.RepoException e)
            {
                return Fail(e);
            }
        }

        // GET: api/projects/{id}/kod/ham?yol=img/robot.png   — görsel ve 3B modeller için ham baytlar
        [HttpGet("ham")]
        public async Task<IActionResult> GetRaw(int id, [FromQuery] string yol, CancellationToken ct)
        {
            if (string.IsNullOrWhiteSpace(yol) || yol.Length > 500) return BadRequest(new { message = "Geçersiz dosya yolu." });
            var (repo, error) = await Resolve(id);
            if (error != null) return error;
            try
            {
                var bytes = await _repos.GetRaw(repo!, yol, RepoService.MaxRawBytes, ct);
                // SVG ve HTML sayfa olarak çalışmasın: her şey indirme/veri olarak sunulur
                var type = ContentTypes.TryGetContentType(yol, out var t) && t.StartsWith("image/") && !t.Contains("svg") ? t : "application/octet-stream";
                Response.Headers["X-Content-Type-Options"] = "nosniff";
                Response.Headers["Content-Security-Policy"] = "default-src 'none'; sandbox";
                return File(bytes, type);
            }
            catch (RepoService.RepoException e)
            {
                return Fail(e);
            }
        }
    }
}
