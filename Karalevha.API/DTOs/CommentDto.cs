using System;
using System.Collections.Generic;

namespace Karalevha.API.DTOs
{
    public class CommentDto
    {
        public int Id { get; set; }
        public string Content { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; }
        
        public UserDto User { get; set; } = new UserDto();
        
        public int? ParentCommentId { get; set; }
        
        public List<CommentDto> Replies { get; set; } = new List<CommentDto>();
    }

    public class UserDto
    {
        public int Id { get; set; }
        public string Username { get; set; } = string.Empty;
        public string? AvatarSeed { get; set; }
    }
}
