using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using System.Threading.Tasks;
using Karalevha.API.Data;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace Karalevha.API.Hubs
{
    [Authorize]
    public class ChatHub : Hub
    {
        private readonly AppDbContext _context;

        public ChatHub(AppDbContext context)
        {
            _context = context;
        }

        public async Task JoinChannel(string channelId)
        {
            if (int.TryParse(channelId, out int cid))
            {
                var channel = await _context.ObaChannels.FindAsync(cid);
                if (channel != null)
                {
                    var oba = await _context.Obalar.FindAsync(channel.ObaId);
                    if (oba != null)
                    {
                        var userIdClaim = Context.UserIdentifier ?? Context.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                        if (userIdClaim != null && int.TryParse(userIdClaim, out int userId))
                        {
                            if (oba.IsPrivate)
                            {
                                var isMember = await _context.ObaMembers.AnyAsync(m => m.ObaId == oba.Id && m.UserId == userId);
                                if (!isMember) throw new HubException("Bu kanala erişim yetkiniz yok.");
                            }
                            await Groups.AddToGroupAsync(Context.ConnectionId, channelId);
                            return;
                        }
                    }
                }
            }
            throw new HubException("Geçersiz kanal veya yetkisiz erişim.");
        }

        public async Task LeaveChannel(string channelId)
        {
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, channelId);
        }
    }
}
