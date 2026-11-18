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
    /// Roller veritabanında durur (User.Role: User / Admin / Owner). Yapılandırma ilk yöneticileri belirler ve
    /// açılışta veritabanına yazılır: "OwnerUsername" Owner olur, "Admins" listesindekiler Admin.
    /// Örnek: dotnet user-secrets set "Admins:0" "kullaniciadi"
    ///
    /// Yönetici olan kullanıcı adları bellekte tutulur; rol değişince <see cref="SetRole"/> ile anında güncellenir,
    /// böylece her istekte veritabanına gidilmez ve yeni rol oturum açmayı beklemeden geçerli olur.
    /// </summary>
    public class CurrentUser
    {
        private readonly HashSet<string> _configAdmins = new(StringComparer.OrdinalIgnoreCase);
        private readonly string? _configOwner;
        private readonly ConcurrentDictionary<string, string> _roles = new(StringComparer.OrdinalIgnoreCase);

        public CurrentUser(IConfiguration config)
        {
            foreach (var name in config.GetSection("Admins").Get<string[]>() ?? Array.Empty<string>())
                if (!string.IsNullOrWhiteSpace(name)) _configAdmins.Add(name.Trim());
            if (config["OwnerUsername"] is { Length: > 0 } owner) _configOwner = owner.Trim();
        }

        public static int? IdOf(ClaimsPrincipal principal) =>
            int.TryParse(principal.FindFirst(ClaimTypes.NameIdentifier)?.Value, out var id) ? id : null;

        public static string NameOf(ClaimsPrincipal principal) =>
            principal.FindFirst(ClaimTypes.Name)?.Value ?? "Bilinmeyen";

        /// <summary>Yapılandırmanın bu kullanıcıya verdiği rol (yoksa null)</summary>
        public string? ConfiguredRole(string username) =>
            _configOwner != null && string.Equals(_configOwner, username, StringComparison.OrdinalIgnoreCase) ? Roles.Owner
            : _configAdmins.Contains(username) ? Roles.Admin
            : null;

        /// <summary>Açılışta: yapılandırmadaki rolleri veritabanına yaz, yöneticileri belleğe al.</summary>
        public async Task LoadAsync(AppDbContext db)
        {
            var wanted = _configAdmins.Select(n => n.ToLowerInvariant()).ToList();
            if (_configOwner != null) wanted.Add(_configOwner.ToLowerInvariant());
            foreach (var user in await db.Users.Where(u => wanted.Contains(u.NormalizedUsername)).ToListAsync())
                Promote(user);
            await db.SaveChangesAsync();

            _roles.Clear();
            foreach (var u in await db.Users.Where(u => u.Role != Roles.User).Select(u => new { u.Username, u.Role }).ToListAsync())
                _roles[u.Username] = u.Role;
        }

        /// <summary>Yapılandırma bu kişiye daha yüksek bir rol veriyorsa uygular (kaydetmez). Rol düşürmez.</summary>
        public void Promote(User user)
        {
            var configured = ConfiguredRole(user.Username);
            if (configured == Roles.Owner || (configured == Roles.Admin && user.Role == Roles.User))
                user.Role = configured;
            SetRole(user.Username, user.Role);
        }

        public void SetRole(string username, string role)
        {
            if (role == Roles.User) _roles.TryRemove(username, out _);
            else _roles[username] = role;
        }

        public string RoleOf(string? username) =>
            username != null && _roles.TryGetValue(username, out var role) ? role : Roles.User;

        public bool IsAdminName(string? username) => Roles.IsStaff(RoleOf(username));

        public bool IsAdmin(ClaimsPrincipal principal) => IsAdminName(principal.FindFirst(ClaimTypes.Name)?.Value);

        public bool IsOwner(ClaimsPrincipal principal) => RoleOf(principal.FindFirst(ClaimTypes.Name)?.Value) == Roles.Owner;

        /// <summary>İçeriğin sahibi ya da kulüp yöneticisi mi?</summary>
        public bool CanManage(ClaimsPrincipal principal, int ownerId) =>
            IdOf(principal) == ownerId || IsAdmin(principal);
    }
}
