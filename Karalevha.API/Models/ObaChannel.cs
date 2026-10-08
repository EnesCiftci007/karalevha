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
        public string Type { get; set; } = "text"; // "text" veya "voice"

        [Required]
        [MaxLength(50)]
        public string Category { get; set; } = "METİN KANALLARI";

        public int ObaId { get; set; }
        
        [ForeignKey("ObaId")]
        public Oba? Oba { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
