using System.ComponentModel.DataAnnotations;

namespace Karalevha.API.DTOs
{
    public class CreateObaDto
    {
        [Required]
        [MaxLength(100)]
        public string Name { get; set; } = string.Empty;

        [MaxLength(500)]
        public string? Description { get; set; }

        [MaxLength(7)]
        [RegularExpression(@"^#[0-9a-fA-F]{6}$", ErrorMessage = "Geçerli bir renk kodu giriniz.")]
        public string Color { get; set; } = "#39ff14";

        public bool IsPrivate { get; set; } = false;

        /// <summary>Listede görünmeyen, yalnızca davetle girilen oba (şifre gerekmez)</summary>
        public bool IsUnlisted { get; set; } = false;

        [MaxLength(72)] // BCrypt en fazla 72 baytı dikkate alır
        public string? JoinPassword { get; set; }
    }
}
