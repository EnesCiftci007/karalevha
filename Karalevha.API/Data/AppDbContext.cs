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
        public DbSet<ObaChannel> ObaChannels { get; set; }
        public DbSet<ObaMessage> ObaMessages { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            // Eşzamanlı (Race Condition) kayıtları veritabanı seviyesinde önlemek için eşsiz (unique) indeksler
            modelBuilder.Entity<User>()
                .HasIndex(u => u.Email)
                .IsUnique();

            modelBuilder.Entity<User>()
                .HasIndex(u => u.NormalizedUsername)
                .IsUnique();
        }
    }
}
