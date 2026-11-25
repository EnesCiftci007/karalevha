using Karalevha.API.Data;
using Karalevha.API.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Karalevha.API.Controllers
{
    /// <summary>
    /// Ana sayfadaki rakamlar. Eskiden istemci bütün listeleri indirip sayıyordu; artık sayım veritabanında.
    /// Giriş yapan kişiye kendi sayıları (projeleri — ekip üyeliği dahil —, modelleri, obaları, paylaşımları),
    /// misafire kulübün toplamı (listede görünmeyen obalar hariç).
    /// </summary>
    [Route("api/istatistik")]
    [ApiController]
    public class StatsController : ControllerBase
    {
        private readonly AppDbContext _context;

        public StatsController(AppDbContext context) => _context = context;

        [HttpGet]
        public async Task<IActionResult> Get()
        {
            var me = CurrentUser.IdOf(User);
            if (me == null)
            {
                return Ok(new
                {
                    mine = false,
                    projects = await _context.Projects.CountAsync(),
                    models = await _context.PrintModels.CountAsync(),
                    obalar = await _context.Obalar.CountAsync(o => !o.IsUnlisted),
                    posts = await _context.Posts.CountAsync(),
                });
            }
            return Ok(new
            {
                mine = true,
                projects = await _context.Projects.CountAsync(p => p.UserId == me || _context.ProjectMembers.Any(m => m.ProjectId == p.Id && m.UserId == me)),
                models = await _context.PrintModels.CountAsync(m => m.UserId == me),
                obalar = await _context.Obalar.CountAsync(o => o.OwnerId == me || _context.ObaMembers.Any(m => m.ObaId == o.Id && m.UserId == me)),
                posts = await _context.Posts.CountAsync(p => p.UserId == me),
            });
        }
    }
}
