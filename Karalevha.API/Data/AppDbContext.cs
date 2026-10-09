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
        public DbSet<UserFollow> UserFollows { get; set; }
        public DbSet<Post> Posts { get; set; }
        public DbSet<PostLike> PostLikes { get; set; }
        public DbSet<Oba> Obalar { get; set; }
        public DbSet<PrintModel> PrintModels { get; set; }
        public DbSet<Project> Projects { get; set; }
        public DbSet<ObaChannel> ObaChannels { get; set; }
        public DbSet<ObaMessage> ObaMessages { get; set; }
        public DbSet<ObaMember> ObaMembers { get; set; }

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

            modelBuilder.Entity<UserFollow>()
                .HasOne(f => f.Follower)
                .WithMany(u => u.Following)
                .HasForeignKey(f => f.FollowerId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<UserFollow>()
                .HasOne(f => f.Following)
                .WithMany(u => u.Followers)
                .HasForeignKey(f => f.FollowingId)
                .OnDelete(DeleteBehavior.Restrict);

            // Çift Kayıt Önleme (Unique Constraints)
            modelBuilder.Entity<ObaMember>()
                .HasIndex(m => new { m.ObaId, m.UserId })
                .IsUnique();

            modelBuilder.Entity<UserFollow>()
                .HasIndex(f => new { f.FollowerId, f.FollowingId })
                .IsUnique();

            modelBuilder.Entity<PostLike>()
                .HasKey(pl => new { pl.PostId, pl.UserId });
        }


    }
}
