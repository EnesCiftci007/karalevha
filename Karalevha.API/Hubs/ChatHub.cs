using Karalevha.API.Data;
using Karalevha.API.Services;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace Karalevha.API.Hubs
{
    /// <summary>
    /// Oba kanallarının canlı mesaj yayını. Bağlantı isteğe bağlı olarak JWT taşır
    /// (?access_token=..., Program.cs). Açık obaların kanallarını herkes dinleyebilir;
    /// gizli obaların kanallarına yalnızca kurucu ve üyeler katılabilir.
    /// </summary>
    public class ChatHub : Hub
    {
        private readonly AppDbContext _context;
        private readonly ObaAccess _access;

        public ChatHub(AppDbContext context, ObaAccess access)
        {
            _context = context;
            _access = access;
        }

        public async Task JoinChannel(string channelId)
        {
            if (!int.TryParse(channelId, out var id))
                throw new HubException("Geçersiz kanal.");

            var channel = await _context.ObaChannels
                .AsNoTracking()
                .Include(c => c.Oba)
                .FirstOrDefaultAsync(c => c.Id == id);
            if (channel?.Oba == null)
                throw new HubException("Kanal bulunamadı.");

            var userId = Context.User == null ? null : CurrentUser.IdOf(Context.User);
            var (canRead, _) = await _access.ChannelAsync(channel, userId);
            if (!canRead)
                throw new HubException("Bu kanalı dinleme yetkin yok.");

            await Groups.AddToGroupAsync(Context.ConnectionId, id.ToString());
        }

        public async Task LeaveChannel(string channelId)
        {
            if (int.TryParse(channelId, out var id))
                await Groups.RemoveFromGroupAsync(Context.ConnectionId, id.ToString());
        }
    }
}
