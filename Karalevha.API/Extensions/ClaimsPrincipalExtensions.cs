using System;
using System.Security.Claims;

namespace Karalevha.API.Extensions
{
    public static class ClaimsPrincipalExtensions
    {
        public static int? GetUserId(this ClaimsPrincipal? principal)
        {
            if (principal == null) return null;
            var claim = principal.FindFirst(ClaimTypes.NameIdentifier);
            if (claim != null && int.TryParse(claim.Value, out int id))
            {
                return id;
            }
            return null;
        }

        public static int GetRequiredUserId(this ClaimsPrincipal? principal)
        {
            var id = principal.GetUserId();
            if (!id.HasValue)
            {
                throw new UnauthorizedAccessException("Kullanıcı kimliği doğrulanamadı.");
            }
            return id.Value;
        }
    }
}
