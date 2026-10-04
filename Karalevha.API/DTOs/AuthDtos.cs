using System.ComponentModel.DataAnnotations;

namespace Karalevha.API.DTOs
{
    public class RegisterDto
    {
        [Required]
        [StringLength(50, MinimumLength = 3, ErrorMessage = "Kullanıcı adı 3-50 karakter olmalıdır.")]
        public string Username { get; set; } = string.Empty;

        [Required]
        [EmailAddress(ErrorMessage = "Geçerli bir e-posta adresi giriniz.")]
        [StringLength(200)]
        public string Email { get; set; } = string.Empty;

        [Required]
        [StringLength(72, MinimumLength = 6, ErrorMessage = "Şifre 6-72 karakter arası olmalıdır (BCrypt güvenliği).")]
        public string Password { get; set; } = string.Empty;
    }

    public class LoginDto
    {
        [Required]
        [StringLength(200)]
        public string UsernameOrEmail { get; set; } = string.Empty;

        [Required]
        [StringLength(72)]
        public string Password { get; set; } = string.Empty;
    }
}
