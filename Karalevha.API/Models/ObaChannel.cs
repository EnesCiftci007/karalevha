using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Karalevha.API.Models
{
    public class ObaChannel
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [MaxLength(50)]
        public string Name { get; set; } = string.Empty;

        [Required]
        [MaxLength(20)]
        public string Type { get; set; } = "text"; // Yalnızca metin kanalı var (ses kanalları kaldırıldı)

        [Required]
        [MaxLength(50)]
        public string Category { get; set; } = "METİN KANALLARI";

        public int ObaId { get; set; }
        
        [ForeignKey("ObaId")]
        public Oba? Oba { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        /// <summary>Kanalı açan kişi. Obayla birlikte gelen varsayılan kanallarda boş.</summary>
        public int? CreatedById { get; set; }

        /// <summary>Gizli kanalı yalnızca eklenen kişiler, kanalı açan ve oba kurucusu görür.</summary>
        public bool IsPrivate { get; set; } = false;
    }
}
