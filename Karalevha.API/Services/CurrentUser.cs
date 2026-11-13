using System.Security.Claims;

namespace Karalevha.API.Services
{
    /// <summary>
    /// Giriş yapmış kullanıcı ve kulüp yöneticisi kontrolü.
    /// Yöneticiler yapılandırmadan gelir: "Admins" listesi ve geriye dönük uyumluluk için "OwnerUsername".
    /// Örnek: dotnet user-secrets set "Admins:0" "kullaniciadi"
    /// </summary>
    public class CurrentUser
    {
        private readonly HashSet<string> _admins;

        public CurrentUser(IConfiguration config)
        {
            _admins = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            foreach (var name in config.GetSection("Admins").Get<string[]>() ?? Array.Empty<string>())
                if (!string.IsNullOrWhiteSpace(name)) _admins.Add(name.Trim());
            if (config["OwnerUsername"] is { Length: > 0 } owner) _admins.Add(owner.Trim());
        }

        public static int? IdOf(ClaimsPrincipal principal) =>
            int.TryParse(principal.FindFirst(ClaimTypes.NameIdentifier)?.Value, out var id) ? id : null;

        public static string NameOf(ClaimsPrincipal principal) =>
            principal.FindFirst(ClaimTypes.Name)?.Value ?? "Bilinmeyen";

        public bool IsAdminName(string? username) => username != null && _admins.Contains(username);

        public bool IsAdmin(ClaimsPrincipal principal) => IsAdminName(principal.FindFirst(ClaimTypes.Name)?.Value);

        /// <summary>İçeriğin sahibi ya da kulüp yöneticisi mi?</summary>
        public bool CanManage(ClaimsPrincipal principal, int ownerId) =>
            IdOf(principal) == ownerId || IsAdmin(principal);
    }
}
