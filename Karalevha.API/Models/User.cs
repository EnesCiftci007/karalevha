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
        
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        /// <summary>Profildeki kısa tanıtım</summary>
        [MaxLength(300)]
        public string? Bio { get; set; }

        /// <summary>İlgi alanları: akışta bu etiketli yeni gönderiler öne çıkar</summary>
        public List<string> Interests { get; set; } = new();

        /// <summary>"User", "Admin" ya da "Owner". Owner rolleri dağıtır; Admin ve Owner kulüp yöneticisidir.</summary>
        [Required]
        [MaxLength(20)]
        public string Role { get; set; } = Roles.User;

        /// <summary>Bu ana kadar hesap askıda: giriş yapamaz, bir şey yazamaz</summary>
        public DateTime? BannedUntil { get; set; }

        // E-posta doğrulama (Auth:RequireEmailVerification açıksa kullanılır)
        public bool EmailConfirmed { get; set; } = true;
        [MaxLength(100)]
        public string? EmailVerificationToken { get; set; }
        public DateTime? EmailVerificationTokenExpiresAt { get; set; }
    }

    public static class Roles
    {
        public const string User = "User";
        public const string Admin = "Admin";
        public const string Owner = "Owner";

        public static bool IsStaff(string? role) => role == Admin || role == Owner;
    }
}
