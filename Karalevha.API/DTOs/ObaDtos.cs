using System.ComponentModel.DataAnnotations;

namespace Karalevha.API.DTOs
{
    public class CreateObaDto
    {
        [Required]
        [MaxLength(100)]
        public string Name { get; set; } = string.Empty;

        [MaxLength(500)]
        public string? Description { get; set; }

        [MaxLength(7)]
        public string Color { get; set; } = "#39ff14";
        
        public bool IsPrivate { get; set; } = false;
    }
}
