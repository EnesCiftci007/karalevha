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
        public DbSet<ObaMember> ObaMembers { get; set; }
        public DbSet<Equipment> Equipment { get; set; }
        public DbSet<Reservation> Reservations { get; set; }
        public DbSet<ClubEvent> Events { get; set; }
        public DbSet<EventAttendee> EventAttendees { get; set; }
        public DbSet<PrintMake> PrintMakes { get; set; }
        public DbSet<Like> Likes { get; set; }
        public DbSet<Comment> Comments { get; set; }
        public DbSet<Notification> Notifications { get; set; }

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

            // Çakışma sorgusu ekipman + zaman aralığına göre yapılır
            modelBuilder.Entity<Reservation>().HasIndex(r => new { r.EquipmentId, r.StartsAt, r.EndsAt });
            modelBuilder.Entity<Reservation>().HasOne(r => r.PrintModel).WithMany().OnDelete(DeleteBehavior.SetNull);

            modelBuilder.Entity<ClubEvent>().HasIndex(e => e.StartsAt);
            modelBuilder.Entity<EventAttendee>().HasIndex(a => new { a.EventId, a.UserId }).IsUnique();
            modelBuilder.Entity<EventAttendee>().HasOne(a => a.Event).WithMany().OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<PrintMake>().HasIndex(m => m.PrintModelId);
            modelBuilder.Entity<PrintMake>().HasOne(m => m.PrintModel).WithMany().OnDelete(DeleteBehavior.Cascade);

            // Bir kişi aynı şeyi bir kez beğenebilir
            modelBuilder.Entity<Like>().HasIndex(l => new { l.TargetType, l.TargetId, l.UserId }).IsUnique();
            modelBuilder.Entity<Comment>().HasIndex(c => new { c.TargetType, c.TargetId, c.CreatedAt });

            modelBuilder.Entity<Notification>().HasIndex(n => new { n.UserId, n.IsRead, n.CreatedAt });
            modelBuilder.Entity<Notification>().HasOne(n => n.Actor).WithMany().HasForeignKey(n => n.ActorId).OnDelete(DeleteBehavior.SetNull);
            modelBuilder.Entity<Notification>().HasOne(n => n.User).WithMany().HasForeignKey(n => n.UserId).OnDelete(DeleteBehavior.Cascade);
        }
    }
}
