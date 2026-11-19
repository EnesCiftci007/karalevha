using System.Collections.Concurrent;
using Karalevha.API.Data;
using Karalevha.API.Hubs;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace Karalevha.API.Services
{
    /// <summary>
    /// Bu API sürecindeki canlı sohbet bağlantıları: kim, hangi kanalları dinliyor. SignalR grubu bir kez
    /// katılınca kendiliğinden kontrol edilmediği için, erişim değişince bağlantıları buradan bulup yeniden
    /// kontrol ederiz (<see cref="ChannelAccessGuard"/>).
    ///
    /// Not: kayıt süreç içidir. Birden fazla API örneği çalışırsa her örnek yalnızca kendi bağlantılarını
    /// bilir; o durumda canlı sohbet zaten ortak bir SignalR arka planı (backplane) ve yapışkan oturum ister.
    /// </summary>
    public class ChatConnections
    {
        private sealed class Entry
        {
            public required HubCallerContext Context { get; init; }
            public int? UserId { get; init; }
            public ConcurrentDictionary<int, byte> Channels { get; } = new();
        }

        private readonly ConcurrentDictionary<string, Entry> _byConnection = new();

        public void Connected(HubCallerContext context, int? userId) =>
            _byConnection[context.ConnectionId] = new Entry { Context = context, UserId = userId };

        public void Disconnected(string connectionId) => _byConnection.TryRemove(connectionId, out _);

        public void Joined(string connectionId, int channelId)
        {
            if (_byConnection.TryGetValue(connectionId, out var e)) e.Channels[channelId] = 0;
        }

        public void Left(string connectionId, int channelId)
        {
            if (_byConnection.TryGetValue(connectionId, out var e)) e.Channels.TryRemove(channelId, out _);
        }

        /// <summary>Bu kanalı dinleyen bağlantılar: (bağlantı, kullanıcı)</summary>
        public List<(string ConnectionId, int? UserId)> Listening(int channelId) =>
            _byConnection.Where(kv => kv.Value.Channels.ContainsKey(channelId)).Select(kv => (kv.Key, kv.Value.UserId)).ToList();

        /// <summary>Kişinin bütün bağlantılarını keser (hesap silindi)</summary>
        public int Abort(int userId)
        {
            var mine = _byConnection.Where(kv => kv.Value.UserId == userId).ToList();
            foreach (var (id, e) in mine)
            {
                _byConnection.TryRemove(id, out _);
                e.Context.Abort();
            }
            return mine.Count;
        }
    }

    /// <summary>
    /// Erişim değişince (kanal kişileri, kanalın gizliliği, obadan ayrılma, kanal/oba/hesap silme) o kanalları
    /// dinleyen bağlantıları güncel kurala göre yeniden kontrol eder; erişimi kalkanı gruptan çıkarır ve
    /// "KanalErisimiKalkti" ile haber verir. Böylece açık kalmış bir bağlantı gizli mesajları almaya devam etmez.
    /// </summary>
    public class ChannelAccessGuard
    {
        public const string RevokedEvent = "KanalErisimiKalkti";

        private readonly AppDbContext _db;
        private readonly ObaAccess _access;
        private readonly ChatConnections _connections;
        private readonly IHubContext<ChatHub> _hub;
        private readonly ILogger<ChannelAccessGuard> _log;

        public ChannelAccessGuard(AppDbContext db, ObaAccess access, ChatConnections connections, IHubContext<ChatHub> hub, ILogger<ChannelAccessGuard> log)
        {
            _db = db;
            _access = access;
            _connections = connections;
            _hub = hub;
            _log = log;
        }

        public async Task RecheckChannelsAsync(IEnumerable<int> channelIds)
        {
            foreach (var channelId in channelIds.Distinct())
            {
                var listeners = _connections.Listening(channelId);
                if (listeners.Count == 0) continue;
                // Değişiklik kaydedildikten sonra çağrılır: güncel durum okunur (izlenen eski nesne değil)
                var channel = await _db.ObaChannels.AsNoTracking().Include(c => c.Oba).FirstOrDefaultAsync(c => c.Id == channelId);
                foreach (var (connectionId, userId) in listeners)
                {
                    var canRead = channel?.Oba != null && (await _access.ChannelAsync(channel, userId)).CanRead;
                    if (canRead) continue;
                    try
                    {
                        await _hub.Groups.RemoveFromGroupAsync(connectionId, channelId.ToString());
                        await _hub.Clients.Client(connectionId).SendAsync(RevokedEvent, channelId);
                    }
                    catch (Exception e)
                    {
                        _log.LogWarning(e, "Kanal erişimi kaldırılırken bağlantı güncellenemedi");
                    }
                    _connections.Left(connectionId, channelId);
                }
            }
        }

        public async Task RecheckObaAsync(int obaId) =>
            await RecheckChannelsAsync(await _db.ObaChannels.Where(c => c.ObaId == obaId).Select(c => c.Id).ToListAsync());
    }
}
