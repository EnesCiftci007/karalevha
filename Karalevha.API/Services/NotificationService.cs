using Karalevha.API.Data;
using Karalevha.API.Hubs;
using Karalevha.API.Models;
using Microsoft.AspNetCore.SignalR;

namespace Karalevha.API.Services
{
    /// <summary>
    /// Bildirim ekler. Kayıt çağıranın SaveChanges'i ile birlikte yazılır, böylece
    /// asıl işlem başarısız olursa yarım bildirim kalmaz. Kayıt başarılı olunca bildirim
    /// alıcının açık sekmelerine SignalR ile (/notificationhub) anında gönderilir.
    /// </summary>
    public class NotificationService
    {
        private readonly AppDbContext _context;
        private readonly IHubContext<NotificationHub> _hub;
        private readonly ILogger<NotificationService> _logger;
        private readonly List<Notification> _pending = new();

        public NotificationService(AppDbContext context, IHubContext<NotificationHub> hub, ILogger<NotificationService> logger)
        {
            _context = context;
            _hub = hub;
            _logger = logger;
            _context.SavedChanges += (_, _) => Push();
        }

        public void Add(int userId, int? actorId, string text, string link)
        {
            if (userId == actorId) return; // kişi kendi eylemi için bildirim almaz
            var notification = new Notification
            {
                UserId = userId,
                ActorId = actorId,
                Text = text.Length > 300 ? text[..297] + "…" : text,
                Link = link,
                CreatedAt = DateTime.UtcNow
            };
            _context.Notifications.Add(notification);
            _pending.Add(notification);
        }

        /// <summary>Kaydedilen bildirimleri alıcılarına gönderir. Gönderim hatası asıl işlemi bozmaz.</summary>
        private void Push()
        {
            var saved = _pending.Where(n => n.Id > 0).ToList();
            if (saved.Count == 0) return;
            _pending.RemoveAll(saved.Contains);

            var actorIds = saved.Where(n => n.ActorId != null).Select(n => n.ActorId!.Value).Distinct().ToList();
            var actors = _context.Users.Local.Where(u => actorIds.Contains(u.Id)).ToDictionary(u => u.Id, u => u.Username);

            foreach (var n in saved)
            {
                var dto = new
                {
                    n.Id,
                    n.Text,
                    n.Link,
                    n.IsRead,
                    n.CreatedAt,
                    Actor = n.ActorId is int a && actors.TryGetValue(a, out var name) ? name : null,
                };
                _ = _hub.Clients.User(n.UserId.ToString()).SendAsync("Bildirim", dto)
                    .ContinueWith(t => _logger.LogWarning(t.Exception, "Bildirim canlı gönderilemedi"), TaskContinuationOptions.OnlyOnFaulted);
            }
        }
    }
}
