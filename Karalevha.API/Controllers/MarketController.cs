using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Karalevha.API.Data;
using Karalevha.API.Models;
using Karalevha.API.Services;

namespace Karalevha.API.Controllers
{
    /// <summary>
    /// Market: kulüp atölyesinden üretim siparişi (CNC, lazer, 3B baskı, PCB).
    /// Demo: ödeme yok. Kişi dosyasını gönderir; yöneticiler fiyat verir ve durumu ilerletir.
    /// Tasarım dosyaları wwwroot dışında durur, yalnızca sahibi ve yöneticiler indirir.
    /// </summary>
    [Route("api/market")]
    [ApiController]
    public class MarketController : ControllerBase
    {
        private const long MaxFileSize = 50_000_000; // 50 MB

        private readonly AppDbContext _context;
        private readonly CurrentUser _current;
        private readonly NotificationService _notifications;
        private readonly string _storage;

        public MarketController(AppDbContext context, CurrentUser current, NotificationService notifications, IConfiguration config, IWebHostEnvironment env)
        {
            _context = context;
            _current = current;
            _notifications = notifications;
            _storage = config["Storage:MarketFilesPath"] is { Length: > 0 } configured
                ? configured
                : Path.Combine(env.ContentRootPath, "App_Data", "market");
            Directory.CreateDirectory(_storage);
        }

        private static object Dto(MarketOrder o, string username) => new
        {
            o.Id,
            o.Service,
            ServiceName = MarketCatalog.Find(o.Service)?.Name ?? o.Service,
            o.Material,
            o.Quantity,
            o.Dimensions,
            o.Note,
            o.FileName,
            o.FileSize,
            o.Status,
            StatusLabel = MarketStatus.Label(o.Status),
            o.Price,
            o.StaffNote,
            o.CreatedAt,
            o.UpdatedAt,
            o.UserId,
            Username = username,
        };

        // GET: api/market/hizmetler
        [HttpGet("hizmetler")]
        public IActionResult GetServices() =>
            Ok(MarketCatalog.Services.Select(s => new { s.Id, s.Name, s.Description, s.Materials, s.Extensions, s.Hint }));

        // POST: api/market/siparis   (multipart: service, material, quantity, dimensions?, note?, file)
        [HttpPost("siparis")]
        [Authorize]
        [EnableRateLimiting("UploadLimiter")]
        [RequestSizeLimit(MaxFileSize + 1_000_000)]
        [RequestFormLimits(MultipartBodyLengthLimit = MaxFileSize + 1_000_000)]
        public async Task<IActionResult> CreateOrder([FromForm] string service, [FromForm] string material, [FromForm] int quantity,
            [FromForm] string? dimensions, [FromForm] string? note, IFormFile file)
        {
            var def = MarketCatalog.Find(service ?? string.Empty);
            if (def == null) return BadRequest(new { message = "Geçersiz hizmet." });
            if (!def.Materials.Contains(material)) return BadRequest(new { message = "Bu hizmet için geçersiz malzeme." });
            if (quantity < 1 || quantity > 100) return BadRequest(new { message = "Adet 1 ile 100 arasında olmalı." });
            dimensions = string.IsNullOrWhiteSpace(dimensions) ? null : dimensions.Trim();
            if (dimensions?.Length > 100) return BadRequest(new { message = "Ölçü en fazla 100 karakter olabilir." });
            note = string.IsNullOrWhiteSpace(note) ? null : note.Trim();
            if (note?.Length > 1000) return BadRequest(new { message = "Not en fazla 1000 karakter olabilir." });

            if (file == null || file.Length == 0) return BadRequest(new { message = "Tasarım dosyanı ekle." });
            if (file.Length > MaxFileSize) return BadRequest(new { message = "Dosya en fazla 50 MB olabilir." });
            var extension = Path.GetExtension(file.FileName).ToLowerInvariant();
            if (!def.Extensions.Contains(extension))
                return BadRequest(new { message = $"{def.Name} için kabul edilen dosyalar: {string.Join(", ", def.Extensions).ToUpperInvariant()}" });

            var stored = $"{Guid.NewGuid()}{extension}";
            var absolute = Path.Combine(_storage, stored);
            await using (var stream = new FileStream(absolute, FileMode.CreateNew))
                await file.CopyToAsync(stream);

            var userId = CurrentUser.IdOf(User)!.Value;
            var order = new MarketOrder
            {
                UserId = userId,
                Service = def.Id,
                Material = material,
                Quantity = quantity,
                Dimensions = dimensions,
                Note = note,
                FileName = Path.GetFileName(file.FileName) is var n && n.Length > 255 ? n[^255..] : Path.GetFileName(file.FileName),
                StoredName = stored,
                FileSize = file.Length,
            };
            _context.MarketOrders.Add(order);

            // Yöneticilere haber ver (bildirim zili)
            var me = CurrentUser.NameOf(User);
            var staff = await _context.Users.Where(u => u.Role == Roles.Admin || u.Role == Roles.Owner).Select(u => u.Id).ToListAsync();
            try
            {
                await _context.SaveChangesAsync();
                foreach (var id in staff)
                    _notifications.Add(id, userId, $"{me} yeni bir {def.Name.ToLowerInvariant()} siparişi verdi.", "/market?sekme=gelen");
                await _context.SaveChangesAsync();
            }
            catch
            {
                System.IO.File.Delete(absolute);
                throw;
            }
            return Ok(Dto(order, me));
        }

        // GET: api/market/siparislerim
        [HttpGet("siparislerim")]
        [Authorize]
        public async Task<IActionResult> MyOrders()
        {
            var me = CurrentUser.IdOf(User);
            var list = await _context.MarketOrders.AsNoTracking()
                .Where(o => o.UserId == me)
                .OrderByDescending(o => o.CreatedAt)
                .ToListAsync();
            var name = CurrentUser.NameOf(User);
            return Ok(list.Select(o => Dto(o, name)));
        }

        // GET: api/market/siparisler?durum=alindi   (yöneticiler)
        [HttpGet("siparisler")]
        [Authorize]
        public async Task<IActionResult> AllOrders([FromQuery] string? durum)
        {
            if (!_current.IsAdmin(User)) return StatusCode(403, new { message = "Gelen siparişleri yalnızca kulüp yöneticileri görür." });
            var query = _context.MarketOrders.AsNoTracking();
            if (!string.IsNullOrEmpty(durum) && MarketStatus.All.Contains(durum)) query = query.Where(o => o.Status == durum);
            var list = await query
                .OrderBy(o => o.Status == MarketStatus.Delivered || o.Status == MarketStatus.Cancelled) // bitenler sonda
                .ThenByDescending(o => o.CreatedAt)
                .Take(200)
                .Select(o => new { Order = o, Username = o.User!.Username })
                .ToListAsync();
            return Ok(list.Select(x => Dto(x.Order, x.Username)));
        }

        // GET: api/market/siparis/{id}/dosya   (sipariş sahibi ya da yönetici)
        [HttpGet("siparis/{id:int}/dosya")]
        [Authorize]
        public async Task<IActionResult> DownloadFile(int id)
        {
            var order = await _context.MarketOrders.AsNoTracking().FirstOrDefaultAsync(o => o.Id == id);
            if (order == null) return NotFound(new { message = "Sipariş bulunamadı." });
            if (!_current.CanManage(User, order.UserId)) return StatusCode(403, new { message = "Bu dosyayı göremezsin." });

            var path = Path.GetFullPath(Path.Combine(_storage, order.StoredName));
            if (!path.StartsWith(Path.GetFullPath(_storage)) || !System.IO.File.Exists(path)) return NotFound(new { message = "Dosya bulunamadı." });
            Response.Headers["X-Content-Type-Options"] = "nosniff";
            return PhysicalFile(path, "application/octet-stream", order.FileName);
        }

        /// <summary>Durum değişikliğini kaydeder ve karşı tarafa bildirir.</summary>
        private void Notify(MarketOrder order, int toUserId, string text) =>
            _notifications.Add(toUserId, CurrentUser.IdOf(User), text, toUserId == order.UserId ? "/market?sekme=siparislerim" : "/market?sekme=gelen");

        // POST: api/market/siparis/{id}/onay   — sahibi, fiyat verilmiş siparişi onaylar
        [HttpPost("siparis/{id:int}/onay")]
        [Authorize]
        public async Task<IActionResult> Approve(int id)
        {
            var order = await _context.MarketOrders.FindAsync(id);
            if (order == null) return NotFound(new { message = "Sipariş bulunamadı." });
            if (order.UserId != CurrentUser.IdOf(User)) return StatusCode(403, new { message = "Bu sipariş senin değil." });
            if (order.Status != MarketStatus.Quoted) return BadRequest(new { message = "Yalnızca fiyat verilmiş sipariş onaylanır." });

            order.Status = MarketStatus.Approved;
            order.UpdatedAt = DateTime.UtcNow;
            var staff = await _context.Users.Where(u => u.Role == Roles.Admin || u.Role == Roles.Owner).Select(u => u.Id).ToListAsync();
            foreach (var s in staff) Notify(order, s, $"{CurrentUser.NameOf(User)} #{order.Id} numaralı siparişin fiyatını onayladı.");
            await _context.SaveChangesAsync();
            return Ok(Dto(order, CurrentUser.NameOf(User)));
        }

        // POST: api/market/siparis/{id}/iptal   — sahibi, üretime girmemiş siparişi iptal eder
        [HttpPost("siparis/{id:int}/iptal")]
        [Authorize]
        public async Task<IActionResult> Cancel(int id)
        {
            var order = await _context.MarketOrders.FindAsync(id);
            if (order == null) return NotFound(new { message = "Sipariş bulunamadı." });
            if (order.UserId != CurrentUser.IdOf(User)) return StatusCode(403, new { message = "Bu sipariş senin değil." });
            if (order.Status is not (MarketStatus.Received or MarketStatus.Quoted or MarketStatus.Approved))
                return BadRequest(new { message = "Üretime girmiş sipariş iptal edilemez; atölyeyle konuş." });

            order.Status = MarketStatus.Cancelled;
            order.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            return Ok(Dto(order, CurrentUser.NameOf(User)));
        }

        public class UpdateOrderDto
        {
            public string Status { get; set; } = string.Empty;
            public decimal? Price { get; set; }
            public string? StaffNote { get; set; }
        }

        // PUT: api/market/siparis/{id}   — yönetici: durum, fiyat, not
        [HttpPut("siparis/{id:int}")]
        [Authorize]
        public async Task<IActionResult> Update(int id, UpdateOrderDto dto)
        {
            if (!_current.IsAdmin(User)) return StatusCode(403, new { message = "Siparişleri yalnızca kulüp yöneticileri günceller." });
            var order = await _context.MarketOrders.Include(o => o.User).FirstOrDefaultAsync(o => o.Id == id);
            if (order == null) return NotFound(new { message = "Sipariş bulunamadı." });
            if (!MarketStatus.All.Contains(dto.Status)) return BadRequest(new { message = "Geçersiz durum." });
            if (dto.Price is < 0 or > 1_000_000) return BadRequest(new { message = "Fiyat 0 ile 1.000.000 TL arasında olmalı." });
            if (dto.Status == MarketStatus.Quoted && dto.Price == null) return BadRequest(new { message = "Fiyat vermek için tutarı yaz." });
            var note = string.IsNullOrWhiteSpace(dto.StaffNote) ? null : dto.StaffNote.Trim();
            if (note?.Length > 1000) return BadRequest(new { message = "Not en fazla 1000 karakter olabilir." });

            var changed = order.Status != dto.Status;
            order.Status = dto.Status;
            order.Price = dto.Price;
            order.StaffNote = note;
            order.UpdatedAt = DateTime.UtcNow;

            if (changed)
            {
                var service = MarketCatalog.Find(order.Service)?.Name ?? order.Service;
                var priceText = dto.Status == MarketStatus.Quoted && dto.Price != null ? $" Fiyat: {dto.Price:0.##} TL." : "";
                Notify(order, order.UserId, $"{service} siparişin (#{order.Id}) {MarketStatus.Label(dto.Status)}.{priceText}");
            }
            await _context.SaveChangesAsync();
            return Ok(Dto(order, order.User!.Username));
        }
    }
}
