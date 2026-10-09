using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Karalevha.API.Models
{
    public class PostComment
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [MaxLength(500)]
        public string Content { get; set; } = string.Empty;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [Required]
        public int PostId { get; set; }
        
        [ForeignKey("PostId")]
        public Post? Post { get; set; }

        [Required]
        public int UserId { get; set; }
        
        [ForeignKey("UserId")]
        public User? User { get; set; }

        public int? ParentCommentId { get; set; }
        
        [ForeignKey("ParentCommentId")]
        public PostComment? ParentComment { get; set; }

        public ICollection<PostComment> Replies { get; set; } = new List<PostComment>();
    }
}
