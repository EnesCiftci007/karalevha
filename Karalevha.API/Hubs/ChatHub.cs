using Microsoft.AspNetCore.SignalR;
using System.Threading.Tasks;

namespace Karalevha.API.Hubs
{
    public class ChatHub : Hub
    {
        public async Task JoinChannel(string channelId)
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, channelId);
        }

        public async Task LeaveChannel(string channelId)
        {
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, channelId);
        }
    }
}
