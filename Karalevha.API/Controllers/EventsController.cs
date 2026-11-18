using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Karalevha.API.Data;
using Karalevha.API.Models;
using Karalevha.API.Services;

namespace Karalevha.API.Controllers
{
    /// <summary>Kulüp etkinlikleri. Her üye etkinlik açabilir; açan kişi ve yöneticiler düzenler/siler.</summary>
    [Route("api/etkinlik")]
    [ApiController]
    public class EventsController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly CurrentUser _current;
        private readonly NotificationService _notifications;

        public EventsController(AppDbContext context, CurrentUser current, NotificationService notifications)
        {
            _context = context;
            _current = current;
            _notifications = notifications;
        }

        private IQueryable<object> Project(IQueryable<ClubEvent> query)
        {
            var me = CurrentUser.IdOf(User);
            return query.Select(e => new
            {
                e.Id,
                e.Title,
                e.Description,
                e.Location,
                e.StartsAt,
                e.EndsAt,
                e.CreatedById,
                CreatedBy = e.CreatedBy!.Username,
                AttendeeCount = _context.EventAttendees.Count(a => a.EventId == e.Id),
                Attending = me != null && _context.EventAttendees.Any(a => a.EventId == e.Id && a.UserId == me),
                Attendees = _context.EventAttendees.Where(a => a.EventId == e.Id).OrderBy(a => a.CreatedAt).Select(a => a.User!.Username).Take(12).ToList()
            });
        }

        // GET: api/etkinlik?gecmis=true
        [HttpGet]
        public async Task<IActionResult> GetEvents([FromQuery] bool gecmis = false, [FromQuery] int take = 50)
        {
            take = Math.Clamp(take, 1, 100);
            // Bitmemiş (ya da bugün başlamış) etkinlikler "yaklaşan" sayılır
            var cutoff = DateTime.UtcNow.AddHours(-6);
            var query = _context.Events.AsNoTracking();
            query = gecmis
                ? query.Where(e => (e.EndsAt ?? e.StartsAt) < cutoff).OrderByDescending(e => e.StartsAt)
                : query.Where(e => (e.EndsAt ?? e.StartsAt) >= cutoff).OrderBy(e => e.StartsAt);
            return Ok(await Project(query.Take(take)).ToListAsync());
        }

        // GET: api/etkinlik/{id}
        [HttpGet("{id:int}")]
        public async Task<IActionResult> GetEvent(int id)
        {
            var item = await Project(_context.Events.AsNoTracking().Where(e => e.Id == id)).FirstOrDefaultAsync();
            return item == null ? NotFound(new { message = "Etkinlik bulunamadı." }) : Ok(item);
        }

        public class EventDto
        {
            public string Title { get; set; } = string.Empty;
            public string? Description { get; set; }
            public string? Location { get; set; }
            public DateTime StartsAt { get; set; }
            public DateTime? EndsAt { get; set; }
        }

        private IActionResult? Validate(EventDto dto)
        {
            var title = dto.Title?.Trim() ?? string.Empty;
            if (title.Length == 0 || title.Length > 150) return BadRequest(new { message = "Başlık 1-150 karakter olmalı." });
            if (dto.Description?.Length > 2000) return BadRequest(new { message = "Açıklama en fazla 2000 karakter olabilir." });
            if (dto.Location?.Length > 150) return BadRequest(new { message = "Yer en fazla 150 karakter olabilir." });
            if (dto.EndsAt != null && dto.EndsAt <= dto.StartsAt) return BadRequest(new { message = "Bitiş, başlangıçtan sonra olmalı." });
            if (dto.StartsAt.ToUniversalTime() > DateTime.UtcNow.AddYears(1)) return BadRequest(new { message = "Etkinlik en fazla bir yıl sonrası için açılabilir." });
            return null;
        }

        private static void Apply(ClubEvent e, EventDto dto)
        {
            e.Title = dto.Title.Trim();
            e.Description = string.IsNullOrWhiteSpace(dto.Description) ? null : dto.Description.Trim();
            e.Location = string.IsNullOrWhiteSpace(dto.Location) ? null : dto.Location.Trim();
            e.StartsAt = dto.StartsAt.ToUniversalTime();
            e.EndsAt = dto.EndsAt?.ToUniversalTime();
        }

        // POST: api/etkinlik
        [HttpPost]
        [Authorize]
        public async Task<IActionResult> CreateEvent(EventDto dto)
        {
            var userId = CurrentUser.IdOf(User);
            if (userId == null) return Unauthorized();
            if (Validate(dto) is { } invalid) return invalid;
            if (dto.StartsAt.ToUniversalTime() < DateTime.UtcNow.AddHours(-1)) return BadRequest(new { message = "Geçmiş bir tarihe etkinlik açılamaz." });

            var item = new ClubEvent { CreatedById = userId.Value };
            Apply(item, dto);
            _context.Events.Add(item);
            await _context.SaveChangesAsync();

            // Açan kişi otomatik katılımcı olur
            _context.EventAttendees.Add(new EventAttendee { EventId = item.Id, UserId = userId.Value });
            await _context.SaveChangesAsync();

            return Ok(await Project(_context.Events.Where(e => e.Id == item.Id)).FirstAsync());
        }

        // PUT: api/etkinlik/{id}
        [HttpPut("{id:int}")]
        [Authorize]
        public async Task<IActionResult> UpdateEvent(int id, EventDto dto)
        {
            var item = await _context.Events.FindAsync(id);
            if (item == null) return NotFound(new { message = "Etkinlik bulunamadı." });
            if (!_current.CanManage(User, item.CreatedById)) return StatusCode(403, new { message = "Bu etkinliği düzenleyemezsin." });
            if (Validate(dto) is { } invalid) return invalid;

            var timeChanged = item.StartsAt != dto.StartsAt.ToUniversalTime();
            Apply(item, dto);

            // Saat değiştiyse katılımcılara haber ver
            if (timeChanged)
            {
                var attendees = await _context.EventAttendees.Where(a => a.EventId == id).Select(a => a.UserId).ToListAsync();
                foreach (var uid in attendees)
                    _notifications.Add(uid, CurrentUser.IdOf(User), $"\"{item.Title}\" etkinliğinin zamanı değişti.", $"/etkinlikler/{id}");
            }

            await _context.SaveChangesAsync();
            return Ok(await Project(_context.Events.Where(e => e.Id == id)).FirstAsync());
        }

        // DELETE: api/etkinlik/{id}
        [HttpDelete("{id:int}")]
        [Authorize]
        public async Task<IActionResult> DeleteEvent(int id)
        {
            var item = await _context.Events.FindAsync(id);
            if (item == null) return NotFound(new { message = "Etkinlik bulunamadı." });
            if (!_current.CanManage(User, item.CreatedById)) return StatusCode(403, new { message = "Bu etkinliği silemezsin." });

            var attendees = await _context.EventAttendees.Where(a => a.EventId == id).Select(a => a.UserId).ToListAsync();
            if (item.StartsAt > DateTime.UtcNow)
                foreach (var uid in attendees)
                    _notifications.Add(uid, CurrentUser.IdOf(User), $"\"{item.Title}\" etkinliği iptal edildi.", "/etkinlikler");

            _context.Events.Remove(item); // katılımcılar cascade ile silinir
            await _context.SaveChangesAsync();
            return Ok(new { success = true });
        }

        // POST: api/etkinlik/{id}/katil   — katılıyorum / katılmıyorum (aç-kapa)
        [HttpPost("{id:int}/katil")]
        [Authorize]
        public async Task<IActionResult> ToggleAttendance(int id)
        {
            var userId = CurrentUser.IdOf(User);
            if (userId == null) return Unauthorized();
            var item = await _context.Events.FindAsync(id);
            if (item == null) return NotFound(new { message = "Etkinlik bulunamadı." });

            var existing = await _context.EventAttendees.FirstOrDefaultAsync(a => a.EventId == id && a.UserId == userId);
            if (existing != null)
            {
                _context.EventAttendees.Remove(existing);
            }
            else
            {
                if ((item.EndsAt ?? item.StartsAt) < DateTime.UtcNow) return BadRequest(new { message = "Bu etkinlik bitti." });
                _context.EventAttendees.Add(new EventAttendee { EventId = id, UserId = userId.Value });
                _notifications.Add(item.CreatedById, userId, $"{CurrentUser.NameOf(User)} \"{item.Title}\" etkinliğine katılıyor.", $"/etkinlikler/{id}");
            }
            await _context.SaveChangesAsync();
            return Ok(await Project(_context.Events.Where(e => e.Id == id)).FirstAsync());
        }
    }
}
