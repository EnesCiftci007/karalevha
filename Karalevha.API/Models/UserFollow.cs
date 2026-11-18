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

    /// <summary>
    /// Etiketler. Gönderide etiket serbest: metindeki #kelime (X'teki gibi) etiket olur.
    /// İlgi alanları ise profilde sabit listeden (All) seçilir; karşılaştırma normalleştirilmiş hâlle yapılır.
    /// </summary>
    public static class PostTags
    {
        private static readonly System.Globalization.CultureInfo Tr = System.Globalization.CultureInfo.GetCultureInfo("tr-TR");

        // Önünde harf, rakam, &, @ ya da / olmayan # (e-posta ve bağlantılar etiket sayılmasın),
        // ardından 2–30 harf, rakam ya da _ (ör. "#arduino", "#çıkmış_sorular")
        private static readonly System.Text.RegularExpressions.Regex Hashtag =
            new(@"(?<![\p{L}\p{N}_&#@/])#([\p{L}\p{N}_]{2,30})", System.Text.RegularExpressions.RegexOptions.Compiled);

        private const string TurkishLetters = "çğışöüÇĞİŞÖÜ";

        /// <summary>
        /// "#Robotik", "3B Baskı" → "robotik", "3bbaskı": küçük harf, yalnızca harf, rakam ve _.
        /// Türkçe harf içeren kelimede Türkçe kural ("IŞIK" → "ışık"), içermeyende uluslararası kural
        /// ("ARDUINO" → "arduino"; Türkçe kuralla "arduıno" olurdu).
        /// </summary>
        public static string Normalize(string? tag)
        {
            var word = (tag ?? string.Empty).Trim().TrimStart('#');
            var lower = word.Any(c => TurkishLetters.Contains(c)) ? word.ToLower(Tr) : word.ToLowerInvariant();
            return new string(lower.Where(c => char.IsLetterOrDigit(c) || c == '_').ToArray());
        }

        /// <summary>Metindeki hashtag'ler, tekrarsız, en fazla <paramref name="max"/> tane</summary>
        public static List<string> FromContent(string content, int max) =>
            Hashtag.Matches(content).Select(m => Normalize(m.Groups[1].Value)).Where(t => t.Length >= 2).Distinct().Take(max).ToList();

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
