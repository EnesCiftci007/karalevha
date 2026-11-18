using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Karalevha.API.Models
{
    /// <summary>
    /// Bir üyenin uygunsuz bulduğu içeriği bildirmesi. Aynı içerik için gelen şikâyetler yönetim
    /// sayfasında birlikte görünür; yönetici içeriği kaldırınca ya da yok sayınca hepsi kapanır.
    /// </summary>
    public class Report
    {
        [Key]
        public int Id { get; set; }

        public int ReporterId { get; set; }
        [ForeignKey("ReporterId")]
        public User? Reporter { get; set; }

        /// <summary>project, model, post, comment, obamessage, user</summary>
        [Required, MaxLength(20)]
        public string TargetType { get; set; } = string.Empty;
        public int TargetId { get; set; }

        /// <summary>spam, uygunsuz, taciz, telif, diger</summary>
        [Required, MaxLength(20)]
        public string Reason { get; set; } = string.Empty;

        [MaxLength(500)]
        public string? Note { get; set; }

        /// <summary>acik, kaldirildi (içerik kaldırıldı / kişi askıya alındı), reddedildi (kurallara aykırı değil)</summary>
        [Required, MaxLength(20)]
        public string Status { get; set; } = ReportStatus.Open;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public int? ResolvedById { get; set; }
        public DateTime? ResolvedAt { get; set; }
        [MaxLength(500)]
        public string? ResolutionNote { get; set; }
    }

    public static class ReportStatus
    {
        public const string Open = "acik";
        public const string Removed = "kaldirildi";
        public const string Dismissed = "reddedildi";
    }
}
