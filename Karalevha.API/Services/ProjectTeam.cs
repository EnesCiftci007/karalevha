using Karalevha.API.Data;
using Microsoft.EntityFrameworkCore;

namespace Karalevha.API.Services
{
    /// <summary>Proje ekibi yetkileri: sahip ya da üye mi</summary>
    public static class ProjectTeam
    {
        /// <summary>Sahip ya da ekip üyesi (model/dosya ekler, yeni sürüm yükler)</summary>
        public static async Task<bool> IsTeamAsync(AppDbContext db, int projectId, int? userId)
        {
            if (userId == null) return false;
            return await db.Projects.AnyAsync(p => p.Id == projectId && p.UserId == userId)
                || await db.ProjectMembers.AnyAsync(m => m.ProjectId == projectId && m.UserId == userId);
        }

        /// <summary>Projenin sahibi</summary>
        public static Task<bool> IsOwnerAsync(AppDbContext db, int projectId, int? userId) =>
            userId == null ? Task.FromResult(false) : db.Projects.AnyAsync(p => p.Id == projectId && p.UserId == userId);
    }
}
