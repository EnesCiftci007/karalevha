using System;
using System.ComponentModel.DataAnnotations;

namespace Karalevha.API.Models
{
    public class User
    {
        [Key]
        public int Id { get; set; }
        
        [Required]
        [MaxLength(50)]
        public string Username { get; set; } = string.Empty;

        [MaxLength(50)]
        public string NormalizedUsername { get; set; } = string.Empty;
        
        [Required]
        [EmailAddress]
        [MaxLength(100)]
        public string Email { get; set; } = string.Empty;
        
        [Required]
        public string PasswordHash { get; set; } = string.Empty;
        
        public string? AvatarSeed { get; set; } // Dicebear bottts için
        
        public string? Bio { get; set; }
        
        public List<string> Interests { get; set; } = new List<string>();

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public ICollection<UserFollow> Followers { get; set; } = new List<UserFollow>();
        public ICollection<UserFollow> Following { get; set; } = new List<UserFollow>();
    }
}
