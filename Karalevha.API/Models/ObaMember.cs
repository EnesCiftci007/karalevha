using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Karalevha.API.Models
{
    public class ObaMember
    {
        [Key]
        public int Id { get; set; }

        public int ObaId { get; set; }
        [ForeignKey("ObaId")]
        public Oba? Oba { get; set; }

        public int UserId { get; set; }
        [ForeignKey("UserId")]
        public User? User { get; set; }

        [Required]
        [MaxLength(20)]
        public string Role { get; set; } = "member"; // "owner", "admin", "member"

        public DateTime JoinedAt { get; set; } = DateTime.UtcNow;
    }
}
