using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json.Serialization;

namespace Karalevha.API.Models
{
    public class PostLike
    {
        [Required]
        public int PostId { get; set; }
        
        [ForeignKey("PostId")]
        [JsonIgnore]
        public Post? Post { get; set; }

        [Required]
        public int UserId { get; set; }
        
        [ForeignKey("UserId")]
        [JsonIgnore]
        public User? User { get; set; }
    }
}
