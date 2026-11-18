using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Karalevha.API.Models
{
    /// <summary>
    /// Projenin çizim ve belgeleri: devre şemaları, teknik çizimler (DXF, STEP), PCB dosyaları,
    /// fotoğraflar, PDF'ler. 3B modeller ayrı tutulur (PrintModel.ProjectId).
    /// </summary>
    public class ProjectFile
    {
        [Key]
        public int Id { get; set; }

        public int ProjectId { get; set; }
        [ForeignKey("ProjectId")]
        public Project? Project { get; set; }

        public int UserId { get; set; }
        [ForeignKey("UserId")]
        public User? User { get; set; }

        /// <summary>Görünen ad (boşsa dosya adı)</summary>
        [Required]
        [MaxLength(120)]
        public string Title { get; set; } = string.Empty;

        /// <summary>Yüklenen dosyanın özgün adı</summary>
        [Required]
        [MaxLength(255)]
        public string FileName { get; set; } = string.Empty;

        /// <summary>Sunucudaki yolu (/uploads/projeler/...)</summary>
        [Required]
        [MaxLength(300)]
        public string FilePath { get; set; } = string.Empty;

        [MaxLength(100)]
        public string ContentType { get; set; } = "application/octet-stream";

        public long Size { get; set; }

        /// <summary>Bölüm: cizim (mekanik/CAD), elektronik, kod. Bkz. ProjectFileTypes.</summary>
        [MaxLength(20)]
        public string Kind { get; set; } = "cizim";

        public DateTime UploadedAt { get; set; } = DateTime.UtcNow;
    }
}
