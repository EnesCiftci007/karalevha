using System.Collections.Concurrent;
using System.Security.Claims;
using Karalevha.API.Data;
using Karalevha.API.Models;
using Microsoft.EntityFrameworkCore;

namespace Karalevha.API.Services
{
    /// <summary>
    /// Giriş yapmış kullanıcı ve kulüp yöneticisi kontrolü.
    ///
    /// Roller yalnızca veritabanında durur (User.Role: User / Admin / Owner). Rolü hiçbir yapılandırma ya da
    /// kayıt vermez: ilk Owner tek seferlik kurulumla (AdminController.BootstrapOwner) atanır, Admin'leri
    /// Owner atar, Owner kuruculuğu devreder. Veritabanında en fazla bir Owner olabilir (IX_Users_SingleOwner).
    /// JWT'de rol yoktur; eski oturumlardaki rol bilgisi de okunmaz.
    ///
    /// Birden fazla API örneği (instance) aynı veritabanını kullanabilir. Her örnek rolleri kısa süre bellekte
    /// tutar ki her istekte veritabanına gidilmesin; tutarlılık şöyle sağlanır:
    /// - Rol değişince <see cref="RoleChangedAsync"/> PostgreSQL NOTIFY ile bütün örneklere haber verir;
    ///   <see cref="RoleChangeListener"/> haberi alıp o kişinin önbelleğini siler (yeni servis gerekmez).
    /// - Haber kaçsa bile önbellekteki rol en fazla Roles:CacheSeconds (60 sn) geçerlidir.
    /// - Dinleme bağlantısı yoksa (kopmuş, henüz kurulmamış) önbellek kullanılmaz; rol her istekte okunur.
    /// - Rol okunamazsa (veritabanı hatası) kişi User sayılır: hata yetki yükseltmez.
    ///
    /// Rol her istekte bir kez çözülür (<see cref="AttachAsync"/>, kimlik doğrulamadan sonra) ve isteğin
    /// kimliğine eklenir; IsAdmin/IsOwner bunu okur, böylece istek boyunca tutarlıdır.
    /// </summary>
    public class CurrentUser
    {
        public const string NotifyChannel = "karalevha_roles";
        /// <summary>İsteğe eklenen rol bilgisinin türü ve vereni: JWT'den gelen hiçbir bilgi bunun yerine geçemez</summary>
        private const string RoleClaimType = "karalevha:db-role";
        private const string RoleClaimIssuer = "KaraLevha.RoleCache";

        private sealed record Entry(string Role, DateTime LoadedAt);

        private readonly ConcurrentDictionary<int, Entry> _roles = new();
        private readonly IServiceScopeFactory _scopes;
        private readonly ILogger<CurrentUser> _log;
        private readonly TimeSpan _maxAge;
        private long _version;
        private volatile bool _listening;
        private DateTime _listeningSince = DateTime.MaxValue;

        public CurrentUser(IServiceScopeFactory scopes, IConfiguration config, ILogger<CurrentUser> log)
        {
            _scopes = scopes;
            _log = log;
            _maxAge = TimeSpan.FromSeconds(Math.Clamp(config.GetValue("Roles:CacheSeconds", 60), 0, 600));
        }

        public static int? IdOf(ClaimsPrincipal principal) =>
            int.TryParse(principal.FindFirst(ClaimTypes.NameIdentifier)?.Value, out var id) ? id : null;

        public static string NameOf(ClaimsPrincipal principal) =>
            principal.FindFirst(ClaimTypes.Name)?.Value ?? "Bilinmeyen";

        /// <summary>
        /// Kişinin güncel rolü: taze önbellekten ya da veritabanından. Okunamazsa User.
        /// Hesap yoksa (silinmiş) null: o oturum artık geçersizdir.
        /// </summary>
        public async Task<string?> GetRoleAsync(int userId, CancellationToken ct = default)
        {
            if (_listening && _roles.TryGetValue(userId, out var cached)
                && cached.LoadedAt >= _listeningSince && DateTime.UtcNow - cached.LoadedAt < _maxAge)
                return cached.Role;

            var version = Interlocked.Read(ref _version);
            string? role;
            try
            {
                using var scope = _scopes.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                role = await db.Users.AsNoTracking().Where(u => u.Id == userId).Select(u => u.Role).FirstOrDefaultAsync(ct);
            }
            catch (Exception e) when (e is not OperationCanceledException)
            {
                _roles.TryRemove(userId, out _);
                _log.LogError(e, "Rol okunamadı; kişi bu istekte User sayılıyor");
                return Roles.User;
            }

            if (role == null)
            {
                _roles.TryRemove(userId, out _);
                return null; // hesap yok (silinmiş)
            }
            // Okurken bir değişiklik haberi geldiyse okunan değer eski olabilir: önbelleğe yazılmaz
            if (Interlocked.Read(ref _version) == version)
                _roles[userId] = new Entry(role, DateTime.UtcNow);
            return role;
        }

        /// <summary>
        /// Kimlik doğrulamadan sonra her istekte: güncel rolü isteğin kimliğine ekler. Hesap silinmişse oturum
        /// (başka bir cihazda açık kalmış çerez) geçersiz sayılır ve istek girişsiz gibi işlenir.
        /// </summary>
        public async Task AttachAsync(HttpContext http)
        {
            if (IdOf(http.User) is not { } id) return;
            var role = await GetRoleAsync(id, http.RequestAborted);
            if (role == null)
            {
                http.User = new ClaimsPrincipal(new ClaimsIdentity());
                return;
            }
            http.User.AddIdentity(new ClaimsIdentity(new[] { new Claim(RoleClaimType, role, ClaimValueTypes.String, RoleClaimIssuer) }));
        }

        /// <summary>
        /// Rol değişikliği kaydedildikten sonra çağrılır: bu örnekte hemen, diğer örneklerde NOTIFY ile geçerli
        /// olur. Bir işlemin içinde çağrılırsa haber işlem onaylanınca gider.
        /// </summary>
        public async Task RoleChangedAsync(AppDbContext db, int userId)
        {
            Invalidate(userId);
            try
            {
                await db.Database.ExecuteSqlAsync($"SELECT pg_notify({NotifyChannel}, {userId.ToString()})");
            }
            catch (Exception e)
            {
                // Diğer örnekler en geç Roles:CacheSeconds içinde veritabanından yeniden okur
                _log.LogError(e, "Rol değişikliği diğer API örneklerine duyurulamadı");
            }
        }

        public void Invalidate(int userId)
        {
            Interlocked.Increment(ref _version);
            _roles.TryRemove(userId, out _);
        }

        /// <summary>Dinleme başladı: kopukken kaçmış olabilecek haberler yüzünden önbellek baştan kurulur</summary>
        public void ListeningStarted()
        {
            Interlocked.Increment(ref _version);
            _roles.Clear();
            _listeningSince = DateTime.UtcNow;
            _listening = true;
        }

        public void ListeningStopped()
        {
            _listening = false;
            _listeningSince = DateTime.MaxValue;
            Interlocked.Increment(ref _version);
            _roles.Clear();
        }

        public bool IsListening => _listening;

        /// <summary>Bu isteğin rolü (<see cref="AttachAsync"/> eklemediyse User)</summary>
        public static string RoleOf(ClaimsPrincipal principal) =>
            principal.Claims.FirstOrDefault(c => c.Type == RoleClaimType && c.Issuer == RoleClaimIssuer)?.Value ?? Roles.User;

        public bool IsAdmin(ClaimsPrincipal principal) => Roles.IsStaff(RoleOf(principal));

        public bool IsOwner(ClaimsPrincipal principal) => RoleOf(principal) == Roles.Owner;

        /// <summary>İçeriğin sahibi ya da kulüp yöneticisi mi?</summary>
        public bool CanManage(ClaimsPrincipal principal, int ownerId) =>
            IdOf(principal) == ownerId || IsAdmin(principal);
    }
}
