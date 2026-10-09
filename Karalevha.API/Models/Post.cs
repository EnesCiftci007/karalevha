using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json.Serialization;

namespace Karalevha.API.Models
{
    public class Post
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [MaxLength(1000)]
        public string Content { get; set; } = string.Empty;

        public List<string> Tags { get; set; } = new List<string>();

        public ICollection<PostLike> PostLikes { get; set; } = new List<PostLike>();

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        // Foreign Key
        [Required]
        public int UserId { get; set; }
        
        [ForeignKey("UserId")]
        public User? User { get; set; }
    }
}
