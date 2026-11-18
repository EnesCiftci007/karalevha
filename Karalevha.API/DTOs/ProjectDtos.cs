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

        /// <summary>İsteğe bağlı GitHub/GitLab deposu</summary>
        [MaxLength(300)]
        public string? RepoUrl { get; set; }

        /// <summary>Projenin dalı (ProjectCategories.All)</summary>
        [MaxLength(20)]
        public string? Category { get; set; }
    }
}
