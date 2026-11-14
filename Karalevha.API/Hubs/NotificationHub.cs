using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace Karalevha.API.Hubs
{
    /// <summary>
    /// Canlı bildirimler. İstemci yalnızca dinler; sunucu NotificationService üzerinden kişiye
    /// (Clients.User, JWT'deki NameIdentifier) gönderir. Jeton ?access_token= ile gelir (Program.cs).
    /// </summary>
    [Authorize]
    public class NotificationHub : Hub
    {
    }
}
