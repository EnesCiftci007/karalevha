using Karalevha.API.Data;
using Karalevha.API.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.EntityFrameworkCore;

namespace Karalevha.API.Filters
{
    /// <summary>Bu uç, askıdaki hesaplara da açık (ör. bildirimleri okundu yapmak).</summary>
    [AttributeUsage(AttributeTargets.Class | AttributeTargets.Method)]
    public class AllowWhileBannedAttribute : Attribute { }

    /// <summary>
    /// Askıya alınmış hesap okuyabilir ama yazamaz: giriş yapmış kişinin GET dışındaki her isteğinde
    /// BannedUntil kontrol edilir. Her uca ayrı ayrı işaret koymak yerine genel filtre olarak eklenir (Program.cs),
    /// böylece yeni eklenen uçlar da kendiliğinden korunur.
    /// </summary>
    public class BanFilter : IAsyncActionFilter
    {
        private readonly AppDbContext _context;

        public BanFilter(AppDbContext context)
        {
            _context = context;
        }

        public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
        {
            var http = context.HttpContext;
            var userId = CurrentUser.IdOf(http.User);
            var isWrite = !HttpMethods.IsGet(http.Request.Method) && !HttpMethods.IsHead(http.Request.Method) && !HttpMethods.IsOptions(http.Request.Method);
            var exempt = context.ActionDescriptor.EndpointMetadata.OfType<AllowWhileBannedAttribute>().Any();

            if (userId != null && isWrite && !exempt)
            {
                var bannedUntil = await _context.Users.Where(u => u.Id == userId).Select(u => u.BannedUntil).FirstOrDefaultAsync();
                if (bannedUntil > DateTime.UtcNow)
                {
                    context.Result = new ObjectResult(new
                    {
                        message = $"Hesabın {bannedUntil.Value.ToLocalTime():dd.MM.yyyy HH:mm} tarihine kadar askıya alındı.",
                        bannedUntil,
                    })
                    { StatusCode = StatusCodes.Status403Forbidden };
                    return;
                }
            }

            await next();
        }
    }
}
