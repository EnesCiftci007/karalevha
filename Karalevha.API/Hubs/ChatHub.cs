using Karalevha.API.Data;
using Karalevha.API.Services;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace Karalevha.API.Hubs
{
    /// <summary>
    /// Oba kanallarının canlı mesaj yayını. Kimlik oturum çerezinden gelir (giriş yapmamış ziyaretçiler de
    /// bağlanabilir). Açık obaların kanallarını herkes dinleyebilir; gizli oba ve gizli kanallara yalnızca
    /// erişimi olanlar katılır. Erişim sonradan kalkarsa <see cref="ChannelAccessGuard"/> bağlantıyı gruptan çıkarır.
    /// </summary>
    public class ChatHub : Hub
    {
        private readonly AppDbContext _context;
        private readonly ObaAccess _access;
        private readonly ChatConnections _connections;

        public ChatHub(AppDbContext context, ObaAccess access, ChatConnections connections)
        {
            _context = context;
            _access = access;
            _connections = connections;
        }

        private int? UserId => Context.User == null ? null : CurrentUser.IdOf(Context.User);

        public override Task OnConnectedAsync()
        {
            _connections.Connected(Context, UserId);
            return base.OnConnectedAsync();
        }

        public override Task OnDisconnectedAsync(Exception? exception)
        {
            _connections.Disconnected(Context.ConnectionId);
            return base.OnDisconnectedAsync(exception);
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

            // Her katılımda (yeniden bağlanma dahil) güncel üyelik veritabanından kontrol edilir
            var (canRead, _) = await _access.ChannelAsync(channel, UserId);
            if (!canRead)
                throw new HubException("Bu kanalı dinleme yetkin yok.");

            await Groups.AddToGroupAsync(Context.ConnectionId, id.ToString());
            _connections.Joined(Context.ConnectionId, id);
        }

        public async Task LeaveChannel(string channelId)
        {
            if (!int.TryParse(channelId, out var id)) return;
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, id.ToString());
            _connections.Left(Context.ConnectionId, id);
        }
    }
}
