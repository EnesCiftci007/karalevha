using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Karalevha.API.Models
{
    public class Notification
    {
        [Key]
        public int Id { get; set; }

        [Required]
        public int RecipientUserId { get; set; }
        [ForeignKey("RecipientUserId")]
        public User? RecipientUser { get; set; }

        [Required]
        public int ActorUserId { get; set; }
        [ForeignKey("ActorUserId")]
        public User? ActorUser { get; set; }

        [Required]
        [MaxLength(20)]
        public string Type { get; set; } = string.Empty; // "Like", "Comment", "Reply"

        public int? PostId { get; set; }
        [ForeignKey("PostId")]
        public Post? Post { get; set; }

        public int? CommentId { get; set; }
        [ForeignKey("CommentId")]
        public PostComment? Comment { get; set; }

        public bool IsRead { get; set; } = false;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
