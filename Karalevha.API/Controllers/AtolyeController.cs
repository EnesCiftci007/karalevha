using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Karalevha.API.Data;
using Karalevha.API.Models;
using Karalevha.API.Services;

namespace Karalevha.API.Controllers
{
    /// <summary>Atölye: ekipman listesi (yönetici yönetir) ve ekipman rezervasyonları (üyeler yapar).</summary>
    [Route("api/atolye")]
    [ApiController]
    public class AtolyeController : ControllerBase
    {
        private static readonly HashSet<string> Kinds = new() { "yazici", "lehim", "lazer", "diger" };
        private static readonly HashSet<string> Statuses = new() { "hazir", "bakimda" };
        private static readonly TimeSpan MaxDuration = TimeSpan.FromHours(12);
        private static readonly TimeSpan MaxAhead = TimeSpan.FromDays(30);

        private readonly AppDbContext _context;
        private readonly CurrentUser _current;
        private readonly NotificationService _notifications;

        public AtolyeController(AppDbContext context, CurrentUser current, NotificationService notifications)
        {
            _context = context;
            _current = current;
            _notifications = notifications;
        }

        // ------------------------------------------------------------ Ekipman

        public class EquipmentDto
        {
            public string Name { get; set; } = string.Empty;
            public string Kind { get; set; } = "yazici";
            public string? Description { get; set; }
            public string Status { get; set; } = "hazir";
        }

        // GET: api/atolye/ekipman
        [HttpGet("ekipman")]
        public async Task<IActionResult> GetEquipment()
        {
            var now = DateTime.UtcNow;
            var list = await _context.Equipment.AsNoTracking()
                .OrderBy(e => e.Kind).ThenBy(e => e.Name)
                .Select(e => new
                {
                    e.Id,
                    e.Name,
                    e.Kind,
                    e.Description,
                    e.Status,
                    // Şu an kullanımda mı?
                    InUse = _context.Reservations.Any(r => r.EquipmentId == e.Id && r.StartsAt <= now && r.EndsAt > now)
                })
                .ToListAsync();
            return Ok(list);
        }

        private IActionResult? ValidateEquipment(EquipmentDto dto)
        {
            var name = dto.Name?.Trim() ?? string.Empty;
            if (name.Length == 0 || name.Length > 100) return BadRequest(new { message = "Ekipman adı 1-100 karakter olmalı." });
            if (!Kinds.Contains(dto.Kind)) return BadRequest(new { message = "Geçersiz ekipman türü." });
            if (!Statuses.Contains(dto.Status)) return BadRequest(new { message = "Geçersiz durum." });
            if (dto.Description?.Length > 500) return BadRequest(new { message = "Açıklama en fazla 500 karakter olabilir." });
            return null;
        }

        // POST: api/atolye/ekipman  (yönetici)
        [HttpPost("ekipman")]
        [Authorize]
        public async Task<IActionResult> CreateEquipment(EquipmentDto dto)
        {
            if (!_current.IsAdmin(User)) return StatusCode(403, new { message = "Ekipmanı yalnızca kulüp yöneticisi ekleyebilir." });
            if (ValidateEquipment(dto) is { } invalid) return invalid;

            var item = new Equipment
            {
                Name = dto.Name.Trim(),
                Kind = dto.Kind,
                Description = string.IsNullOrWhiteSpace(dto.Description) ? null : dto.Description.Trim(),
                Status = dto.Status
            };
            _context.Equipment.Add(item);
            await _context.SaveChangesAsync();
            return Ok(new { item.Id, item.Name, item.Kind, item.Description, item.Status, InUse = false });
        }

        // PUT: api/atolye/ekipman/{id}  (yönetici)
        [HttpPut("ekipman/{id:int}")]
        [Authorize]
        public async Task<IActionResult> UpdateEquipment(int id, EquipmentDto dto)
        {
            if (!_current.IsAdmin(User)) return StatusCode(403, new { message = "Ekipmanı yalnızca kulüp yöneticisi düzenleyebilir." });
            if (ValidateEquipment(dto) is { } invalid) return invalid;
            var item = await _context.Equipment.FindAsync(id);
            if (item == null) return NotFound(new { message = "Ekipman bulunamadı." });

            item.Name = dto.Name.Trim();
            item.Kind = dto.Kind;
            item.Description = string.IsNullOrWhiteSpace(dto.Description) ? null : dto.Description.Trim();
            item.Status = dto.Status;
            await _context.SaveChangesAsync();
            return Ok(new { success = true });
        }

        // DELETE: api/atolye/ekipman/{id}  (yönetici; rezervasyonları da silinir)
        [HttpDelete("ekipman/{id:int}")]
        [Authorize]
        public async Task<IActionResult> DeleteEquipment(int id)
        {
            if (!_current.IsAdmin(User)) return StatusCode(403, new { message = "Ekipmanı yalnızca kulüp yöneticisi silebilir." });
            var item = await _context.Equipment.FindAsync(id);
            if (item == null) return NotFound(new { message = "Ekipman bulunamadı." });

            _context.Reservations.RemoveRange(_context.Reservations.Where(r => r.EquipmentId == id));
            _context.Equipment.Remove(item);
            await _context.SaveChangesAsync();
            return Ok(new { success = true });
        }

        // ------------------------------------------------------------ Rezervasyon

        private static IQueryable<object> ProjectReservations(IQueryable<Reservation> query) =>
            query.Select(r => new
            {
                r.Id,
                r.EquipmentId,
                EquipmentName = r.Equipment!.Name,
                r.StartsAt,
                r.EndsAt,
                r.Note,
                r.UserId,
                Username = r.User!.Username,
                r.PrintModelId,
                PrintModelTitle = r.PrintModel != null ? r.PrintModel.Title : null
            });

        // GET: api/atolye/rezervasyon?from=...&to=...&equipmentId=...
        [HttpGet("rezervasyon")]
        public async Task<IActionResult> GetReservations([FromQuery] DateTime? from, [FromQuery] DateTime? to, [FromQuery] int? equipmentId)
        {
            var start = (from ?? DateTime.UtcNow.Date).ToUniversalTime();
            var end = (to ?? start.AddDays(7)).ToUniversalTime();
            if (end <= start || end - start > TimeSpan.FromDays(62)) return BadRequest(new { message = "Geçersiz tarih aralığı." });

            var query = _context.Reservations.AsNoTracking().Where(r => r.EndsAt > start && r.StartsAt < end);
            if (equipmentId != null) query = query.Where(r => r.EquipmentId == equipmentId);

            return Ok(await ProjectReservations(query.OrderBy(r => r.StartsAt)).ToListAsync());
        }

        // GET: api/atolye/rezervasyon/benim  (gelecek ve süren rezervasyonlarım)
        [HttpGet("rezervasyon/benim")]
        [Authorize]
        public async Task<IActionResult> GetMyReservations()
        {
            var userId = CurrentUser.IdOf(User);
            var now = DateTime.UtcNow;
            return Ok(await ProjectReservations(_context.Reservations.AsNoTracking()
                .Where(r => r.UserId == userId && r.EndsAt > now)
                .OrderBy(r => r.StartsAt)).ToListAsync());
        }

        public class ReservationDto
        {
            public int EquipmentId { get; set; }
            public DateTime StartsAt { get; set; }
            public DateTime EndsAt { get; set; }
            public string? Note { get; set; }
            public int? PrintModelId { get; set; }
        }

        // POST: api/atolye/rezervasyon
        [HttpPost("rezervasyon")]
        [Authorize]
        public async Task<IActionResult> CreateReservation(ReservationDto dto)
        {
            var userId = CurrentUser.IdOf(User);
            if (userId == null) return Unauthorized();

            var equipment = await _context.Equipment.FindAsync(dto.EquipmentId);
            if (equipment == null) return NotFound(new { message = "Ekipman bulunamadı." });
            if (equipment.Status != "hazir") return BadRequest(new { message = $"{equipment.Name} şu an bakımda, rezervasyon yapılamaz." });

            var start = dto.StartsAt.ToUniversalTime();
            var end = dto.EndsAt.ToUniversalTime();
            var now = DateTime.UtcNow;
            if (end <= start) return BadRequest(new { message = "Bitiş saati başlangıçtan sonra olmalı." });
            if (end - start > MaxDuration) return BadRequest(new { message = "Bir rezervasyon en fazla 12 saat olabilir." });
            if (start < now.AddMinutes(-5)) return BadRequest(new { message = "Geçmiş bir saate rezervasyon yapılamaz." });
            if (start > now + MaxAhead) return BadRequest(new { message = "En fazla 30 gün sonrasına rezervasyon yapılabilir." });

            var note = string.IsNullOrWhiteSpace(dto.Note) ? null : dto.Note.Trim();
            if (note?.Length > 300) return BadRequest(new { message = "Not en fazla 300 karakter olabilir." });

            if (dto.PrintModelId != null && !await _context.PrintModels.AnyAsync(m => m.Id == dto.PrintModelId))
                return BadRequest(new { message = "Seçilen model bulunamadı." });

            // Kullanıcıya kimin hangi saatleri tuttuğunu söyleyebilmek için önce bakılır. Asıl garanti veritabanında:
            // EX_Reservations_NoOverlap kuralı, aynı anda gelen iki istekten yalnızca birini kaydeder.
            var clash = await FindClashAsync(dto.EquipmentId, start, end);
            if (clash != null) return clash;

            var reservation = new Reservation
            {
                EquipmentId = dto.EquipmentId,
                UserId = userId.Value,
                StartsAt = start,
                EndsAt = end,
                Note = note,
                PrintModelId = dto.PrintModelId
            };
            _context.Reservations.Add(reservation);
            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateException ex) when (ex.InnerException is Npgsql.PostgresException { SqlState: Npgsql.PostgresErrorCodes.ExclusionViolation })
            {
                // Ön kontrolden sonra, kaydetmeden önce başka biri aynı saatleri ayırdı
                _context.Entry(reservation).State = EntityState.Detached;
                return await FindClashAsync(dto.EquipmentId, start, end)
                       ?? Conflict(new { message = "Bu saatler az önce başka biri tarafından ayrıldı, lütfen tekrar dene." });
            }
            return Ok(await ProjectReservations(_context.Reservations.Where(r => r.Id == reservation.Id)).FirstAsync());
        }

        /// <summary>Aynı ekipmanda bu aralıkla kesişen rezervasyon varsa 409 (kimde, hangi saatler); yoksa null.
        /// Bitişi diğerinin başlangıcına eşit olan ardışık rezervasyonlar çakışmaz.</summary>
        private async Task<IActionResult?> FindClashAsync(int equipmentId, DateTime start, DateTime end)
        {
            var clash = await _context.Reservations.AsNoTracking()
                .Include(r => r.User)
                .Where(r => r.EquipmentId == equipmentId && r.StartsAt < end && r.EndsAt > start)
                .OrderBy(r => r.StartsAt)
                .FirstOrDefaultAsync();
            if (clash == null) return null;
            var tr = TimeZoneInfo.FindSystemTimeZoneById("Europe/Istanbul");
            string fmt(DateTime t) => TimeZoneInfo.ConvertTimeFromUtc(DateTime.SpecifyKind(t, DateTimeKind.Utc), tr).ToString("HH:mm");
            return Conflict(new { message = $"Bu saatler dolu: {clash.User?.Username} {fmt(clash.StartsAt)}–{fmt(clash.EndsAt)} arasında kullanıyor." });
        }

        // DELETE: api/atolye/rezervasyon/{id}  (sahibi ya da yönetici)
        [HttpDelete("rezervasyon/{id:int}")]
        [Authorize]
        public async Task<IActionResult> CancelReservation(int id)
        {
            var reservation = await _context.Reservations.Include(r => r.Equipment).FirstOrDefaultAsync(r => r.Id == id);
            if (reservation == null) return NotFound(new { message = "Rezervasyon bulunamadı." });
            if (!_current.CanManage(User, reservation.UserId)) return StatusCode(403, new { message = "Bu rezervasyonu iptal edemezsin." });

            _context.Reservations.Remove(reservation);

            // Yönetici başkasının rezervasyonunu iptal ettiyse sahibine haber ver
            if (CurrentUser.IdOf(User) != reservation.UserId)
                _notifications.Add(reservation.UserId, CurrentUser.IdOf(User),
                    $"{reservation.Equipment?.Name} rezervasyonun yönetici tarafından iptal edildi.", "/atolye");

            await _context.SaveChangesAsync();
            return Ok(new { success = true });
        }
    }
}
