using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Karalevha.API.Models
{
    public class UserFollow
    {
        [Key]
        public int Id { get; set; }

        public int FollowerId { get; set; }
        [ForeignKey("FollowerId")]
        public User? Follower { get; set; }

        public int FollowingId { get; set; }
        [ForeignKey("FollowingId")]
        public User? Following { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
