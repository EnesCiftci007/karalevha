namespace Karalevha.API.Services
{
    /// <summary>wwwroot/uploads altındaki dosyalar için yardımcılar.</summary>
    public static class UploadFiles
    {
        public static string WebRoot(IWebHostEnvironment env) =>
            env.WebRootPath ?? Path.Combine(Directory.GetCurrentDirectory(), "wwwroot");

        /// <summary>
        /// "/uploads/..." biçimindeki göreli yolları diskten siler. Yalnızca uploads klasörünün içindekiler:
        /// dışarı taşan (../) ya da mutlak yollar yok sayılır.
        /// </summary>
        public static void Delete(IWebHostEnvironment env, IEnumerable<string?> relativePaths)
        {
            var root = WebRoot(env);
            var uploads = Path.GetFullPath(Path.Combine(root, "uploads"));
            foreach (var relative in relativePaths)
            {
                if (string.IsNullOrWhiteSpace(relative)) continue;
                var path = Path.GetFullPath(Path.Combine(root, relative.TrimStart('/')));
                if (path.StartsWith(uploads + Path.DirectorySeparatorChar) && File.Exists(path))
                    File.Delete(path);
            }
        }
    }
}
