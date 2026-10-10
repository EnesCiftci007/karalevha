using Karalevha.API.Data;
using Karalevha.API.Models;
using Microsoft.AspNetCore.SignalR;
using Karalevha.API.Hubs;
using Microsoft.Extensions.Logging;

namespace Karalevha.API.Services
{
    public interface INotificationService
    {
        Task SendNotificationAsync(int recipientUserId, int actorUserId, string type, int? postId, int? commentId);
    }

    public class NotificationService : INotificationService
    {
        private readonly AppDbContext _context;
        private readonly IHubContext<NotificationHub> _hubContext;
        private readonly ILogger<NotificationService> _logger;

        public NotificationService(AppDbContext context, IHubContext<NotificationHub> hubContext, ILogger<NotificationService> logger)
        {
            _context = context;
            _hubContext = hubContext;
            _logger = logger;
        }

        public async Task SendNotificationAsync(int recipientUserId, int actorUserId, string type, int? postId, int? commentId)
        {
            if (recipientUserId == actorUserId) return;

            try 
            {
                var notification = new Notification
                {
                    RecipientUserId = recipientUserId,
                    ActorUserId = actorUserId,
                    Type = type,
                    PostId = postId,
                    CommentId = commentId,
                    CreatedAt = DateTime.UtcNow
                };

                _context.Notifications.Add(notification);
                await _context.SaveChangesAsync();

                try 
                {
                    await _hubContext.Clients.User(recipientUserId.ToString()).SendAsync("ReceiveNotification");
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Failed to send SignalR notification to User {UserId}", recipientUserId);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to save Notification for User {UserId}", recipientUserId);
            }
        }
    }
}
