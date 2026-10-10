using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace Karalevha.API.Hubs
{
    [Authorize]
    public class NotificationHub : Hub
    {
    }
}
