using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Karalevha.API.Models
{
    /// <summary>
    /// Projenin ekibi: sahibi (Project.UserId) dışındaki üyeler. Üyeler model ve dosya ekler, yeni sürüm
    /// yükler; projeyi düzenlemek, silmek ve ekibi yönetmek sahibindedir.
    /// </summary>
    public class ProjectMember
    {
        [Key]
        public int Id { get; set; }

        public int ProjectId { get; set; }
        [ForeignKey("ProjectId")]
        public Project? Project { get; set; }

        public int UserId { get; set; }
        [ForeignKey("UserId")]
        public User? User { get; set; }

        public DateTime AddedAt { get; set; } = DateTime.UtcNow;
    }

    /// <summary>
    /// Bir proje dosyasının ya da 3B modelin eski sürümü. Yeni sürüm yüklenince o anki dosya buraya
    /// taşınır (dosyanın kendisi depoda kalır); dosya ya da model silinince sürümleri de gider.
    /// </summary>
    public class FileVersion
    {
        [Key]
        public int Id { get; set; }

        /// <summary>Hangisinin sürümü: proje dosyası ya da model (biri dolu)</summary>
        public int? ProjectFileId { get; set; }
        [ForeignKey("ProjectFileId")]
        public ProjectFile? ProjectFile { get; set; }

        public int? PrintModelId { get; set; }
        [ForeignKey("PrintModelId")]
        public PrintModel? PrintModel { get; set; }

        public int Version { get; set; }

        [Required, MaxLength(300)]
        public string FilePath { get; set; } = string.Empty;

        [Required, MaxLength(255)]
        public string FileName { get; set; } = string.Empty;

        public long Size { get; set; }

        /// <summary>Bu sürümü yükleyen</summary>
        public int? UserId { get; set; }
        [ForeignKey("UserId")]
        public User? User { get; set; }

        /// <summary>Bu sürüm yüklendiğinde yazılan değişiklik notu</summary>
        [MaxLength(300)]
        public string? Note { get; set; }

        /// <summary>Bu sürümün yüklendiği an</summary>
        public DateTime CreatedAt { get; set; }
    }
}
