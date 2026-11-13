using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Karalevha.API.Models
{
    /// <summary>Kulüp etkinliği: atölye, toplantı, yarışma…</summary>
    public class ClubEvent
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [MaxLength(150)]
        public string Title { get; set; } = string.Empty;

        [MaxLength(2000)]
        public string? Description { get; set; }

        [MaxLength(150)]
        public string? Location { get; set; }

        /// <summary>UTC</summary>
        public DateTime StartsAt { get; set; }
        /// <summary>UTC, isteğe bağlı</summary>
        public DateTime? EndsAt { get; set; }

        public int CreatedById { get; set; }
        [ForeignKey("CreatedById")]
        public User? CreatedBy { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }

    public class EventAttendee
    {
        [Key]
        public int Id { get; set; }

        public int EventId { get; set; }
        [ForeignKey("EventId")]
        public ClubEvent? Event { get; set; }

        public int UserId { get; set; }
        [ForeignKey("UserId")]
        public User? User { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }

    /// <summary>"Bunu bastım": bir 3B modelin basılmış hâlinin fotoğrafı.</summary>
    public class PrintMake
    {
        [Key]
        public int Id { get; set; }

        public int PrintModelId { get; set; }
        [ForeignKey("PrintModelId")]
        public PrintModel? PrintModel { get; set; }

        public int UserId { get; set; }
        [ForeignKey("UserId")]
        public User? User { get; set; }

        /// <summary>/uploads/makes/... göreli yolu</summary>
        [Required]
        [MaxLength(200)]
        public string PhotoPath { get; set; } = string.Empty;

        [MaxLength(500)]
        public string? Note { get; set; }

        /// <summary>Yazıcı, malzeme, katman yüksekliği gibi ayarlar</summary>
        [MaxLength(300)]
        public string? Settings { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }

    /// <summary>Beğeni. TargetType: "post", "project", "model".</summary>
    public class Like
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [MaxLength(20)]
        public string TargetType { get; set; } = string.Empty;
        public int TargetId { get; set; }

        public int UserId { get; set; }
        [ForeignKey("UserId")]
        public User? User { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }

    /// <summary>Yorum. TargetType: "post", "project", "model".</summary>
    public class Comment
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [MaxLength(20)]
        public string TargetType { get; set; } = string.Empty;
        public int TargetId { get; set; }

        public int UserId { get; set; }
        [ForeignKey("UserId")]
        public User? User { get; set; }

        [Required]
        [MaxLength(1000)]
        public string Content { get; set; } = string.Empty;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }

    public class Notification
    {
        [Key]
        public int Id { get; set; }

        /// <summary>Bildirimi alan</summary>
        public int UserId { get; set; }
        [ForeignKey("UserId")]
        public User? User { get; set; }

        /// <summary>Bildirime sebep olan (yoksa sistem)</summary>
        public int? ActorId { get; set; }
        [ForeignKey("ActorId")]
        public User? Actor { get; set; }

        [Required]
        [MaxLength(300)]
        public string Text { get; set; } = string.Empty;

        /// <summary>Tıklanınca gidilecek site içi adres</summary>
        [Required]
        [MaxLength(200)]
        public string Link { get; set; } = "/";

        public bool IsRead { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
