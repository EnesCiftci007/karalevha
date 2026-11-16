using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Karalevha.API.Models
{
    public class PrintModel
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [MaxLength(100)]
        public string Title { get; set; } = string.Empty;

        [MaxLength(500)]
        public string? Description { get; set; }

        [Required]
        public string FilePath { get; set; } = string.Empty; // Model dosyasının sunucudaki göreli yolu (/uploads/...)
        
        [Required]
        public string FileName { get; set; } = string.Empty; // Orijinal dosya adı

        /// <summary>"baski" (3B yazıcı için) ya da "oyun" (oyun / görselleştirme modeli)</summary>
        [Required]
        [MaxLength(20)]
        public string Category { get; set; } = "baski";

        public DateTime UploadedAt { get; set; } = DateTime.UtcNow;

        /// <summary>Modelin ait olduğu proje. 3B modeller artık projelerin "Modeller" bölümünde durur.</summary>
        public int? ProjectId { get; set; }
        [ForeignKey("ProjectId")]
        public Project? Project { get; set; }

        [Required]
        public int UserId { get; set; }
        
        [ForeignKey("UserId")]
        public User? User { get; set; }
    }
}
