const fs = require('fs');

// 1. Update User.cs
let userCs = fs.readFileSync('Karalevha.API/Models/User.cs', 'utf8');
if (!userCs.includes('public string? Bio')) {
  userCs = userCs.replace(
    'public DateTime CreatedAt { get; set; } = DateTime.UtcNow;\r\n    }\r\n}',
    `public string? Bio { get; set; }\r\n        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;\r\n        public ICollection<UserFollow> Followers { get; set; } = new List<UserFollow>();\r\n        public ICollection<UserFollow> Following { get; set; } = new List<UserFollow>();\r\n    }\r\n}`
  );
  userCs = userCs.replace(
    'public DateTime CreatedAt { get; set; } = DateTime.UtcNow;\n    }\n}',
    `public string? Bio { get; set; }\n        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;\n        public ICollection<UserFollow> Followers { get; set; } = new List<UserFollow>();\n        public ICollection<UserFollow> Following { get; set; } = new List<UserFollow>();\n    }\n}`
  );
  fs.writeFileSync('Karalevha.API/Models/User.cs', userCs);
}

// 2. Update AppDbContext.cs
let dbContext = fs.readFileSync('Karalevha.API/Data/AppDbContext.cs', 'utf8');
if (!dbContext.includes('public DbSet<UserFollow> UserFollows')) {
  dbContext = dbContext.replace(
    'public DbSet<User> Users { get; set; }',
    'public DbSet<User> Users { get; set; }\r\n        public DbSet<UserFollow> UserFollows { get; set; }'
  );

  // We also need to configure relationships in OnModelCreating so EF Core doesn't throw cyclical cascade delete errors
  const onModelCreating = `
        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

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
        }`;
  
  dbContext = dbContext.replace('    }\r\n}', onModelCreating + '\r\n    }\r\n}');
  dbContext = dbContext.replace('    }\n}', onModelCreating + '\n    }\n}');
  fs.writeFileSync('Karalevha.API/Data/AppDbContext.cs', dbContext);
}
