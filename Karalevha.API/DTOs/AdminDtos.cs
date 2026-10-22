namespace Karalevha.API.DTOs
{
    public class SetRoleDto
    {
        public int UserId { get; set; }
        public string Role { get; set; } = string.Empty;
    }

    public class BanUserDto
    {
        public int UserId { get; set; }
        public int DurationMinutes { get; set; }
        public int DurationHours { get; set; }
    }

    public class UnbanUserDto
    {
        public int UserId { get; set; }
    }
}
