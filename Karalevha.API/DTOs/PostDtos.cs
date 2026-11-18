using System.ComponentModel.DataAnnotations;

namespace Karalevha.API.DTOs
{
    public class CreatePostDto
    {
        [Required]
        [MaxLength(1000)]
        public string Content { get; set; } = string.Empty;

        /// <summary>Kullanılmıyor: etiketler metindeki #kelimelerden okunur (eski istemciler için duruyor)</summary>
        public List<string>? Tags { get; set; }
    }
}
