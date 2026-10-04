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
        public string FilePath { get; set; } = string.Empty; // STL dosyasının sunucudaki yolu
        
        [Required]
        public string FileName { get; set; } = string.Empty; // Orijinal dosya adı

        public DateTime UploadedAt { get; set; } = DateTime.UtcNow;

        [Required]
        public int UserId { get; set; }
        
        [ForeignKey("UserId")]
        public User? User { get; set; }
    }
}
