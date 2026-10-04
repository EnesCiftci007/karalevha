using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Karalevha.API.Models
{
    public class Oba
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [MaxLength(100)]
        public string Name { get; set; } = string.Empty;

        [MaxLength(500)]
        public string? Description { get; set; }

        public string AvatarSeed { get; set; } = string.Empty;
        
        [MaxLength(7)]
        public string Color { get; set; } = "#39ff14"; // Neon Yeşil varsayılan

        public int MemberCount { get; set; } = 1; // Kurucu dahil

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        // Kurucu (Owner)
        [Required]
        public int OwnerId { get; set; }
        
        [ForeignKey("OwnerId")]
        public User? Owner { get; set; }
    }
}
