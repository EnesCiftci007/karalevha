using Karalevha.API.Data;
using Karalevha.API.Models;

namespace Karalevha.API.Services
{
    /// <summary>
    /// Bildirim ekler. Kayıt çağıranın SaveChanges'i ile birlikte yazılır, böylece
    /// asıl işlem başarısız olursa yarım bildirim kalmaz.
    /// </summary>
    public class NotificationService
    {
        private readonly AppDbContext _context;

        public NotificationService(AppDbContext context)
        {
            _context = context;
        }

        public void Add(int userId, int? actorId, string text, string link)
        {
            if (userId == actorId) return; // kişi kendi eylemi için bildirim almaz
            _context.Notifications.Add(new Notification
            {
                UserId = userId,
                ActorId = actorId,
                Text = text.Length > 300 ? text[..297] + "…" : text,
                Link = link,
                CreatedAt = DateTime.UtcNow
            });
        }
    }
}
