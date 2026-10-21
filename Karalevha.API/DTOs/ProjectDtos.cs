using System.ComponentModel.DataAnnotations;

namespace Karalevha.API.DTOs
{
    public class CreateProjectDto
    {
        [Required]
        [MaxLength(100)]
        public string Title { get; set; } = string.Empty;

        [Required]
        [MaxLength(1000)]
        public string Description { get; set; } = string.Empty;

        [Required]
        [MaxLength(500)]
        [Url]
        [RegularExpression(@"^https?://.+", ErrorMessage = "Repo URL 'http://' veya 'https://' ile başlamalıdır.")]
        public string RepoUrl { get; set; } = string.Empty;
    }
}
