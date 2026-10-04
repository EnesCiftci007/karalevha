using Microsoft.EntityFrameworkCore;
using Karalevha.API.Models;

namespace Karalevha.API.Data
{
    public class AppDbContext : DbContext
    {
        public AppDbContext(DbContextOptions<AppDbContext> options) : base(options)
        {
        }

        public DbSet<User> Users { get; set; }
        public DbSet<Post> Posts { get; set; }
        public DbSet<Oba> Obalar { get; set; }
        public DbSet<PrintModel> PrintModels { get; set; }
        public DbSet<Project> Projects { get; set; }
    }
}
