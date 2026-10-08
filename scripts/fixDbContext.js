const fs = require('fs');
let c = fs.readFileSync('Karalevha.API/Data/AppDbContext.cs', 'utf8');

c = c.replace(
  /        protected override void OnModelCreating\(ModelBuilder modelBuilder\)\r?\n\s*\{\r?\n\s*base\.OnModelCreating\(modelBuilder\);\r?\n\r?\n\s*modelBuilder\.Entity<UserFollow>\(\)[\s\S]*?OnDelete\(DeleteBehavior\.Restrict\);\r?\n\s*\}/,
  ""
);

c = c.replace(
  '                .IsUnique();\r\n        }',
  `                .IsUnique();

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
        }`
);

fs.writeFileSync('Karalevha.API/Data/AppDbContext.cs', c);
