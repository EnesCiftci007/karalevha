using System.ComponentModel.DataAnnotations;

namespace Karalevha.API.DTOs
{
    public class RegisterDto
    {
        [Required]
        [StringLength(50, MinimumLength = 3, ErrorMessage = "Kullanıcı adı 3-50 karakter olmalıdır.")]
        [RegularExpression(@"^[a-zA-Z0-9_]+$", ErrorMessage = "Sadece İngilizce harf, rakam ve alt çizgi kullanılabilir.")]
        public string Username { get; set; } = string.Empty;

        [Required]
        [EmailAddress(ErrorMessage = "Geçerli bir e-posta adresi giriniz.")]
        [StringLength(200)]
        public string Email { get; set; } = string.Empty;

        [Required]
        [StringLength(128, MinimumLength = 6, ErrorMessage = "Şifre 6-128 karakter arası olmalıdır.")]
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
