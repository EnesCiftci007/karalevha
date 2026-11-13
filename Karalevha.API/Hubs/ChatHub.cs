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

        public ChatHub(AppDbContext context)
        {
            _context = context;
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

            if (channel.Oba.IsPrivate)
            {
                var userId = Context.User == null ? null : CurrentUser.IdOf(Context.User);
                var allowed = userId != null && (
                    channel.Oba.OwnerId == userId ||
                    await _context.ObaMembers.AnyAsync(m => m.ObaId == channel.ObaId && m.UserId == userId));
                if (!allowed)
                    throw new HubException("Bu kanalı dinleme yetkin yok.");
            }

            await Groups.AddToGroupAsync(Context.ConnectionId, id.ToString());
        }

        public async Task LeaveChannel(string channelId)
        {
            if (int.TryParse(channelId, out var id))
                await Groups.RemoveFromGroupAsync(Context.ConnectionId, id.ToString());
        }
    }
}
