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
    ///
    /// Yönetici olan kullanıcı adları bellekte tutulur; rol değişince <see cref="SetRole"/> ile anında güncellenir,
    /// böylece her istekte veritabanına gidilmez ve yeni rol oturum açmayı beklemeden geçerli olur.
    /// </summary>
    public class CurrentUser
    {
        private readonly ConcurrentDictionary<string, string> _roles = new(StringComparer.OrdinalIgnoreCase);

        public static int? IdOf(ClaimsPrincipal principal) =>
            int.TryParse(principal.FindFirst(ClaimTypes.NameIdentifier)?.Value, out var id) ? id : null;

        public static string NameOf(ClaimsPrincipal principal) =>
            principal.FindFirst(ClaimTypes.Name)?.Value ?? "Bilinmeyen";

        /// <summary>Açılışta: yöneticileri veritabanından belleğe al (hiçbir rolü değiştirmez).</summary>
        public async Task LoadAsync(AppDbContext db)
        {
            _roles.Clear();
            foreach (var u in await db.Users.Where(u => u.Role != Roles.User).Select(u => new { u.Username, u.Role }).ToListAsync())
                _roles[u.Username] = u.Role;
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
