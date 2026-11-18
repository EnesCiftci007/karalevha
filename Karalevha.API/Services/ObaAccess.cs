using Karalevha.API.Data;
using Karalevha.API.Models;
using Microsoft.EntityFrameworkCore;

namespace Karalevha.API.Services
{
    /// <summary>
    /// Oba ve kanal erişim kuralları. Mesajlar, canlı sohbet (SignalR) ve kanal listesi aynı kuralı kullanır.
    ///
    /// Açık oba: herkes okur, üyeler (ve kurucu) yazar. Üyelik "Katıl" ile alınır.
    /// Gizli oba: okumak ve yazmak üyelik (ya da kuruculuk) ister.
    /// Gizli kanal: yukarıdakine ek olarak yalnızca oba kurucusu, kanalı açan kişi ve kanala eklenenler.
    /// </summary>
    public class ObaAccess
    {
        private readonly AppDbContext _context;

        public ObaAccess(AppDbContext context)
        {
            _context = context;
        }

        /// <summary>Kişi obanın kurucusu ya da üyesi mi?</summary>
        public async Task<bool> IsInsideAsync(Oba oba, int? userId) =>
            userId != null && (oba.OwnerId == userId ||
                await _context.ObaMembers.AnyAsync(m => m.ObaId == oba.Id && m.UserId == userId));

        /// <summary>Kanalı okuyabilir / yazabilir mi? Kanalın Oba'sı yüklenmiş olmalı.</summary>
        public async Task<(bool CanRead, bool CanWrite)> ChannelAsync(ObaChannel channel, int? userId)
        {
            var oba = channel.Oba ?? throw new InvalidOperationException("Kanalın obası yüklenmedi.");

            if (!channel.IsPrivate)
            {
                var inside = await IsInsideAsync(oba, userId);
                return (inside || !oba.IsPrivate, inside);
            }

            if (userId == null || !await IsInsideAsync(oba, userId)) return (false, false);
            var allowed = oba.OwnerId == userId || channel.CreatedById == userId ||
                await _context.ObaChannelMembers.AnyAsync(m => m.ChannelId == channel.Id && m.UserId == userId);
            return (allowed, allowed);
        }

        /// <summary>Obada kişinin görebileceği kanallar (gizli kanallar süzülmüş).</summary>
        public IQueryable<ObaChannel> VisibleChannels(Oba oba, int? userId)
        {
            var isOwner = userId != null && oba.OwnerId == userId;
            return _context.ObaChannels.Where(c => c.ObaId == oba.Id && (
                !c.IsPrivate || isOwner ||
                (userId != null && (c.CreatedById == userId ||
                    _context.ObaChannelMembers.Any(m => m.ChannelId == c.Id && m.UserId == userId)))));
        }

        /// <summary>Kanalın adını, kişilerini değiştirebilir ya da silebilir mi: oba kurucusu veya kanalı açan.</summary>
        public static bool CanManage(ObaChannel channel, int? userId) =>
            userId != null && (channel.Oba?.OwnerId == userId || channel.CreatedById == userId);

        /// <summary>Gizli kanalı okuyabilen kişiler (bahsetme bildirimleri için).</summary>
        public async Task<HashSet<int>> PrivateChannelReadersAsync(ObaChannel channel)
        {
            var ids = await _context.ObaChannelMembers.Where(m => m.ChannelId == channel.Id).Select(m => m.UserId).ToListAsync();
            var set = new HashSet<int>(ids) { channel.Oba!.OwnerId };
            if (channel.CreatedById is int creator) set.Add(creator);
            return set;
        }
    }
}
