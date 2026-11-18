using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Karalevha.API.Models
{
    public class ObaMessage
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [MaxLength(2000)]
        public string Content { get; set; } = string.Empty;

        public int ChannelId { get; set; }
        
        [ForeignKey("ChannelId")]
        public ObaChannel? Channel { get; set; }

        public int UserId { get; set; }

        [ForeignKey("UserId")]
        public User? User { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        // Ek dosya (opsiyonel). Dosyanın kendisi diskte FileStoredName adıyla durur.
        [MaxLength(255)]
        public string? FileName { get; set; } // Kullanıcının yüklediği orijinal ad

        [MaxLength(100)]
        public string? FileStoredName { get; set; } // Diskteki GUID tabanlı ad

        [MaxLength(100)]
        public string? FileContentType { get; set; }

        public long? FileSize { get; set; }
    }
}
