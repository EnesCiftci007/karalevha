using System.ComponentModel.DataAnnotations;

namespace Karalevha.API.DTOs
{
    public class CreatePostDto
    {
        [Required]
        [MaxLength(1000)]
        public string Content { get; set; } = string.Empty;

        public List<string>? Tags { get; set; }
    }
}
