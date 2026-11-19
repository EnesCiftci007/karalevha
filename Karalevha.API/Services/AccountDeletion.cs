using Karalevha.API.Data;
using Karalevha.API.Models;
using Microsoft.EntityFrameworkCore;

namespace Karalevha.API.Services
{
    /// <summary>
    /// Hesabı ve kişinin verilerini siler (KVKK: kişisel verilerin silinmesini isteme hakkı).
    ///
    /// Başkalarının emeği korunur:
    /// - Ekibi olan proje en eski ekip üyesine, üyesi olan oba en eski üyeye devredilir.
    /// - Başkasının projesine yüklenen model ve dosyalar o projenin sahibine geçer.
    /// - Kişinin oluşturduğu etkinlikler başka bir kulüp yöneticisine geçer.
    /// Geri kalan her şey (gönderi, yorum, beğeni, mesaj, baskı fotoğrafı, sipariş, rezervasyon,
    /// bildirim, şikâyet, takip) depodaki dosyalarıyla birlikte silinir.
    /// </summary>
    public class AccountDeletion
    {
        private readonly AppDbContext _db;
        private readonly IFileStore _store;
        private readonly ObaFileStorage _obaFiles;
        private readonly ILogger<AccountDeletion> _log;

        public AccountDeletion(AppDbContext db, IFileStore store, ObaFileStorage obaFiles, ILogger<AccountDeletion> log)
        {
            _db = db;
            _store = store;
            _obaFiles = obaFiles;
            _log = log;
        }

        public async Task DeleteAsync(int userId)
        {
            var publicFiles = new List<string?>();   // /uploads/... yolları
            var obaFiles = new List<string?>();      // oba-files/ adları
            var marketFiles = new List<string>();    // market/ adları

            await using var tx = await _db.Database.BeginTransactionAsync();

            // ---- Projeler: ekibi varsa devret, yoksa sil
            var projects = await _db.Projects.Where(p => p.UserId == userId).ToListAsync();
            var deletedProjectIds = new List<int>();
            foreach (var project in projects)
            {
                var heir = await _db.ProjectMembers.Where(m => m.ProjectId == project.Id).OrderBy(m => m.AddedAt).FirstOrDefaultAsync();
                if (heir != null)
                {
                    project.UserId = heir.UserId;
                    _db.ProjectMembers.Remove(heir);
                    _db.Notifications.Add(new Notification { UserId = heir.UserId, Text = $"\"{project.Title}\" projesinin sahibi hesabını sildi; proje artık senin.", Link = $"/projeler/{project.Id}" });
                }
                else
                {
                    deletedProjectIds.Add(project.Id);
                }
            }
            await _db.SaveChangesAsync();

            if (deletedProjectIds.Count > 0)
            {
                var models = await _db.PrintModels.Where(m => m.ProjectId != null && deletedProjectIds.Contains(m.ProjectId.Value)).Select(m => new { m.Id, m.FilePath }).ToListAsync();
                var modelIds = models.Select(m => m.Id).ToList();
                publicFiles.AddRange(models.Select(m => m.FilePath));
                publicFiles.AddRange(await _db.PrintMakes.Where(m => modelIds.Contains(m.PrintModelId)).Select(m => m.PhotoPath).ToListAsync());
                publicFiles.AddRange(await _db.ProjectFiles.Where(f => deletedProjectIds.Contains(f.ProjectId)).Select(f => f.FilePath).ToListAsync());
                publicFiles.AddRange(await _db.FileVersions
                    .Where(v => (v.ProjectFileId != null && deletedProjectIds.Contains(v.ProjectFile!.ProjectId)) || (v.PrintModelId != null && modelIds.Contains(v.PrintModelId.Value)))
                    .Select(v => v.FilePath).ToListAsync());
                await RemoveSocial("project", deletedProjectIds);
                await RemoveSocial("model", modelIds);
                // Modeller, dosyalar, sürümler ve baskı fotoğrafları cascade ile gider
                await _db.Projects.Where(p => deletedProjectIds.Contains(p.Id)).ExecuteDeleteAsync();
            }

            // ---- Başkasının projesine yükledikleri: proje sahibine geçer
            // (Toplu güncelleme başka tablodaki sahibi okuyamıyor: önce kime geçeceği okunur, sahip başına güncellenir)
            var foreignModels = await _db.PrintModels.Where(m => m.UserId == userId && m.ProjectId != null)
                .Select(m => new { m.Id, Owner = m.Project!.UserId }).ToListAsync();
            foreach (var group in foreignModels.GroupBy(m => m.Owner))
            {
                var ids = group.Select(m => m.Id).ToList();
                await _db.PrintModels.Where(m => ids.Contains(m.Id)).ExecuteUpdateAsync(s => s.SetProperty(m => m.UserId, group.Key));
            }
            var foreignFiles = await _db.ProjectFiles.Where(f => f.UserId == userId)
                .Select(f => new { f.Id, Owner = f.Project!.UserId }).ToListAsync();
            foreach (var group in foreignFiles.GroupBy(f => f.Owner))
            {
                var ids = group.Select(f => f.Id).ToList();
                await _db.ProjectFiles.Where(f => ids.Contains(f.Id)).ExecuteUpdateAsync(s => s.SetProperty(f => f.UserId, group.Key));
            }
            // Projesiz eski modeller silinir
            var looseModels = await _db.PrintModels.Where(m => m.UserId == userId && m.ProjectId == null).Select(m => new { m.Id, m.FilePath }).ToListAsync();
            if (looseModels.Count > 0)
            {
                var ids = looseModels.Select(m => m.Id).ToList();
                publicFiles.AddRange(looseModels.Select(m => m.FilePath));
                publicFiles.AddRange(await _db.PrintMakes.Where(m => ids.Contains(m.PrintModelId)).Select(m => m.PhotoPath).ToListAsync());
                publicFiles.AddRange(await _db.FileVersions.Where(v => v.PrintModelId != null && ids.Contains(v.PrintModelId.Value)).Select(v => v.FilePath).ToListAsync());
                await RemoveSocial("model", ids);
                await _db.PrintModels.Where(m => ids.Contains(m.Id)).ExecuteDeleteAsync();
            }
            await _db.ProjectMembers.Where(m => m.UserId == userId).ExecuteDeleteAsync();

            // ---- Gönderiler, yorumlar, beğeniler, baskı fotoğrafları
            var postIds = await _db.Posts.Where(p => p.UserId == userId).Select(p => p.Id).ToListAsync();
            await RemoveSocial("post", postIds);
            await _db.Posts.Where(p => p.UserId == userId).ExecuteDeleteAsync();

            var commentIds = await _db.Comments.Where(c => c.UserId == userId).Select(c => c.Id).ToListAsync();
            // Yorumla birlikte ona yazılan yanıtlar da gider (sitedeki yorum silme ile aynı)
            var withReplies = await _db.Comments.Where(c => commentIds.Contains(c.Id) || (c.ParentId != null && commentIds.Contains(c.ParentId.Value))).Select(c => c.Id).ToListAsync();
            await _db.Likes.Where(l => l.TargetType == "comment" && withReplies.Contains(l.TargetId)).ExecuteDeleteAsync();
            await _db.Comments.Where(c => withReplies.Contains(c.Id)).ExecuteDeleteAsync();
            await _db.Likes.Where(l => l.UserId == userId).ExecuteDeleteAsync();

            publicFiles.AddRange(await _db.PrintMakes.Where(m => m.UserId == userId).Select(m => m.PhotoPath).ToListAsync());
            await _db.PrintMakes.Where(m => m.UserId == userId).ExecuteDeleteAsync();

            // ---- Obalar: üyesi varsa en eski üyeye devret, yoksa sil
            var ownedObas = await _db.Obalar.Where(o => o.OwnerId == userId).ToListAsync();
            foreach (var oba in ownedObas)
            {
                var heir = await _db.ObaMembers.Where(m => m.ObaId == oba.Id && m.UserId != userId).OrderBy(m => m.JoinedAt).FirstOrDefaultAsync();
                if (heir != null)
                {
                    oba.OwnerId = heir.UserId;
                    oba.MemberCount = Math.Max(1, oba.MemberCount - 1);
                    _db.ObaMembers.Remove(heir);
                    _db.Notifications.Add(new Notification { UserId = heir.UserId, Text = $"\"{oba.Name}\" obasının kurucusu hesabını sildi; oba artık senin.", Link = $"/e-oba/{oba.Id}" });
                }
                else
                {
                    var channelIds = await _db.ObaChannels.Where(c => c.ObaId == oba.Id).Select(c => c.Id).ToListAsync();
                    obaFiles.AddRange(await _db.ObaMessages.Where(m => channelIds.Contains(m.ChannelId) && m.FileStoredName != null).Select(m => m.FileStoredName).ToListAsync());
                    await _db.ObaMessages.Where(m => channelIds.Contains(m.ChannelId)).ExecuteDeleteAsync();
                    await _db.ObaChannels.Where(c => c.ObaId == oba.Id).ExecuteDeleteAsync();
                    await _db.ObaMembers.Where(m => m.ObaId == oba.Id).ExecuteDeleteAsync();
                    _db.Obalar.Remove(oba);
                }
            }
            await _db.SaveChangesAsync();

            obaFiles.AddRange(await _db.ObaMessages.Where(m => m.UserId == userId && m.FileStoredName != null).Select(m => m.FileStoredName).ToListAsync());
            await _db.ObaMessages.Where(m => m.UserId == userId).ExecuteDeleteAsync();
            var memberOf = await _db.ObaMembers.Where(m => m.UserId == userId).Select(m => m.ObaId).ToListAsync();
            await _db.Obalar.Where(o => memberOf.Contains(o.Id)).ExecuteUpdateAsync(s => s.SetProperty(o => o.MemberCount, o => o.MemberCount > 1 ? o.MemberCount - 1 : 1));
            await _db.ObaMembers.Where(m => m.UserId == userId).ExecuteDeleteAsync();

            // ---- Market, atölye, etkinlikler
            marketFiles.AddRange(await _db.MarketOrders.Where(o => o.UserId == userId).Select(o => o.StoredName).ToListAsync());
            await _db.MarketOrders.Where(o => o.UserId == userId).ExecuteDeleteAsync();
            await _db.Reservations.Where(r => r.UserId == userId).ExecuteDeleteAsync();
            await _db.EventAttendees.Where(a => a.UserId == userId).ExecuteDeleteAsync();
            if (await _db.Events.AnyAsync(e => e.CreatedById == userId))
            {
                // Kulübün etkinlikleri kaybolmasın: başka bir yönetici üstlenir (yoksa silinir)
                var steward = await _db.Users.Where(u => u.Id != userId && (u.Role == Roles.Owner || u.Role == Roles.Admin))
                    .OrderBy(u => u.Role == Roles.Owner ? 0 : 1).ThenBy(u => u.Id).Select(u => (int?)u.Id).FirstOrDefaultAsync();
                if (steward is { } id)
                    await _db.Events.Where(e => e.CreatedById == userId).ExecuteUpdateAsync(s => s.SetProperty(e => e.CreatedById, id));
                else
                    await _db.Events.Where(e => e.CreatedById == userId).ExecuteDeleteAsync();
            }

            // ---- Şikâyetler, bildirimler, takipler, hesap
            await _db.Reports.Where(r => r.ReporterId == userId || (r.TargetType == "user" && r.TargetId == userId)).ExecuteDeleteAsync();
            await _db.Reports.Where(r => r.ResolvedById == userId).ExecuteUpdateAsync(s => s.SetProperty(r => r.ResolvedById, (int?)null));
            await _db.Notifications.Where(n => n.UserId == userId || n.ActorId == userId).ExecuteDeleteAsync();
            await _db.UserFollows.Where(f => f.FollowerId == userId || f.FollowingId == userId).ExecuteDeleteAsync();
            await _db.Users.Where(u => u.Id == userId).ExecuteDeleteAsync();

            await tx.CommitAsync();

            // Kayıtlar gittikten sonra dosyalar; biri silinemezse hesap silme geri alınmaz
            await UploadFiles.DeleteAsync(_store, publicFiles, _log);
            foreach (var name in obaFiles) await _obaFiles.DeleteAsync(name);
            foreach (var name in marketFiles)
            {
                try { await _store.DeleteAsync($"market/{Path.GetFileName(name)}"); }
                catch (Exception e) { _log.LogWarning(e, "Sipariş dosyası silinemedi: {Name}", name); }
            }
        }

        /// <summary>Silinen içeriklerin beğeni ve yorumları (yanıtlarıyla)</summary>
        private async Task RemoveSocial(string type, List<int> ids)
        {
            if (ids.Count == 0) return;
            var comments = await _db.Comments.Where(c => c.TargetType == type && ids.Contains(c.TargetId)).Select(c => c.Id).ToListAsync();
            await _db.Likes.Where(l => (l.TargetType == type && ids.Contains(l.TargetId)) || (l.TargetType == "comment" && comments.Contains(l.TargetId))).ExecuteDeleteAsync();
            await _db.Comments.Where(c => comments.Contains(c.Id)).ExecuteDeleteAsync();
        }
    }
}
