using System;

namespace Karalevha.API.DTOs
{
    public class NotificationDto
    {
        public int Id { get; set; }
        public string Type { get; set; } = string.Empty;
        public int? PostId { get; set; }
        public int? CommentId { get; set; }
        public bool IsRead { get; set; }
        public DateTime CreatedAt { get; set; }
        
        public NotificationActorDto Actor { get; set; } = new();
    }

    public class NotificationActorDto
    {
        public int Id { get; set; }
        public string Username { get; set; } = string.Empty;
        public string? AvatarSeed { get; set; }
    }
}
