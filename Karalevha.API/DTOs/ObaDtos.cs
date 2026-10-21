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
        public string Color { get; set; } = "#39ff14";
        
        public bool IsPrivate { get; set; } = false;
        
        [MaxLength(72, ErrorMessage = "Oba şifresi en fazla 72 karakter olabilir.")]
        public string? JoinPassword { get; set; }
    }

    public class JoinObaDto
    {
        [MaxLength(72)]
        public string? Password { get; set; }
    }

    public class CreateChannelDto
    {
        [Required]
        [MaxLength(50)]
        public string Name { get; set; } = string.Empty;

        [RegularExpression("^(text|voice)$", ErrorMessage = "Kanal türü 'text' veya 'voice' olmalıdır.")]
        public string Type { get; set; } = "text";

        [MaxLength(50)]
        public string? Category { get; set; }
    }
}
