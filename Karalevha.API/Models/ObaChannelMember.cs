using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Karalevha.API.Models
{
    /// <summary>Gizli bir kanala eklenmiş kişi.</summary>
    public class ObaChannelMember
    {
        [Key]
        public int Id { get; set; }

        public int ChannelId { get; set; }
        [ForeignKey("ChannelId")]
        public ObaChannel? Channel { get; set; }

        public int UserId { get; set; }
        [ForeignKey("UserId")]
        public User? User { get; set; }

        public DateTime AddedAt { get; set; } = DateTime.UtcNow;
    }
}
