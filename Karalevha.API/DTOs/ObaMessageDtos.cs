using System.ComponentModel.DataAnnotations;

namespace Karalevha.API.DTOs
{
    public class CreateMessageDto
    {
        [Required]
        [MaxLength(2000, ErrorMessage = "Mesaj en fazla 2000 karakter olabilir.")]
        public string Content { get; set; } = string.Empty;
    }
}
