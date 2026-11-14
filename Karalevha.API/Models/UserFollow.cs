using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Karalevha.API.Models
{
    /// <summary>Follower, Following'i takip ediyor.</summary>
    public class UserFollow
    {
        [Key]
        public int Id { get; set; }

        public int FollowerId { get; set; }
        [ForeignKey("FollowerId")]
        public User? Follower { get; set; }

        public int FollowingId { get; set; }
        [ForeignKey("FollowingId")]
        public User? Following { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }

    /// <summary>Gönderi etiketleri ve ilgi alanları aynı listeden seçilir.</summary>
    public static class PostTags
    {
        public static readonly string[] All =
        {
            "Yazılım", "Robotik", "3B Baskı", "Elektronik", "El İşi", "Tasarım", "Oyun Geliştirme", "IoT", "Duyuru",
        };

        /// <summary>Listede olmayanları atar, tekrarları siler, en fazla <paramref name="max"/> tane bırakır.</summary>
        public static List<string> Clean(IEnumerable<string>? tags, int max) =>
            (tags ?? Enumerable.Empty<string>())
                .Select(t => All.FirstOrDefault(a => string.Equals(a, t?.Trim(), StringComparison.OrdinalIgnoreCase)))
                .Where(t => t != null)
                .Select(t => t!)
                .Distinct()
                .Take(max)
                .ToList();
    }
}
