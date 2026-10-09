using System.ComponentModel.DataAnnotations;

namespace Karalevha.API.DTOs
{
    public class CreateCommentDto
    {
        [Required]
        [MaxLength(500)]
        public string Content { get; set; } = string.Empty;

        public int? ParentCommentId { get; set; }
    }
}
