using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using System.Security.Claims;
using Karalevha.API.Data;
using Microsoft.EntityFrameworkCore;

namespace Karalevha.API.Filters
{
    [AttributeUsage(AttributeTargets.Class | AttributeTargets.Method)]
    public class CheckBannedAttribute : TypeFilterAttribute
    {
        public CheckBannedAttribute() : base(typeof(CheckBannedFilter))
        {
        }
    }

    public class CheckBannedFilter : IAsyncActionFilter
    {
        private readonly AppDbContext _context;

        public CheckBannedFilter(AppDbContext context)
        {
            _context = context;
        }

        public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
        {
            var user = context.HttpContext.User;
            if (user?.Identity?.IsAuthenticated == true)
            {
                var userIdClaim = user.FindFirst(ClaimTypes.NameIdentifier);
                if (userIdClaim != null && int.TryParse(userIdClaim.Value, out int userId))
                {
                    var bannedUntil = await _context.Users
                        .Where(u => u.Id == userId)
                        .Select(u => u.BannedUntil)
                        .FirstOrDefaultAsync();

                    if (bannedUntil.HasValue && bannedUntil.Value > DateTime.UtcNow)
                    {
                        context.Result = new ObjectResult(new
                        {
                            message = $"Hesabınız {bannedUntil.Value:dd.MM.yyyy HH:mm} tarihine kadar askıya alınmıştır.",
                            bannedUntil = bannedUntil.Value
                        })
                        {
                            StatusCode = StatusCodes.Status403Forbidden
                        };
                        return;
                    }
                }
            }

            await next();
        }
    }
}
