using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Karalevha.API.Models
{
    public class Project
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [MaxLength(100)]
        public string Title { get; set; } = string.Empty;

        [Required]
        [MaxLength(1000)]
        public string Description { get; set; } = string.Empty;

        /// <summary>GitHub/GitLab deposu. İsteğe bağlı: yalnızca donanım ya da tasarım olan projelerde boş.</summary>
        public string RepoUrl { get; set; } = string.Empty;

        /// <summary>Projenin dalı: robotik, elektronik, yazilim, tasarim (3B tasarım), diger. Projeler sayfası buna göre süzülür.</summary>
        [MaxLength(20)]
        public string Category { get; set; } = "diger";

        public int Stars { get; set; } = 0;
        public int Forks { get; set; } = 0;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [Required]
        public int UserId { get; set; }
        
        [ForeignKey("UserId")]
        public User? User { get; set; }
    }
}
