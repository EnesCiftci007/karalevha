using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Karalevha.API.Models
{
    /// <summary>Kulübün rezerve edilebilir ekipmanı: 3B yazıcı, lehim istasyonu, lazer kesici…</summary>
    public class Equipment
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [MaxLength(100)]
        public string Name { get; set; } = string.Empty;

        /// <summary>"yazici", "lehim", "lazer", "diger"</summary>
        [Required]
        [MaxLength(20)]
        public string Kind { get; set; } = "yazici";

        [MaxLength(500)]
        public string? Description { get; set; }

        /// <summary>"hazir" ya da "bakimda" (bakımdaki ekipmana rezervasyon yapılamaz)</summary>
        [Required]
        [MaxLength(20)]
        public string Status { get; set; } = "hazir";

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }

    /// <summary>Bir ekipmanın belirli bir zaman aralığı için ayrılması.</summary>
    public class Reservation
    {
        [Key]
        public int Id { get; set; }

        public int EquipmentId { get; set; }
        [ForeignKey("EquipmentId")]
        public Equipment? Equipment { get; set; }

        public int UserId { get; set; }
        [ForeignKey("UserId")]
        public User? User { get; set; }

        /// <summary>UTC</summary>
        public DateTime StartsAt { get; set; }
        /// <summary>UTC</summary>
        public DateTime EndsAt { get; set; }

        [MaxLength(300)]
        public string? Note { get; set; }

        /// <summary>Basılacak model (isteğe bağlı)</summary>
        public int? PrintModelId { get; set; }
        [ForeignKey("PrintModelId")]
        public PrintModel? PrintModel { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
