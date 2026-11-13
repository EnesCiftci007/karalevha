using Microsoft.AspNetCore.StaticFiles;

namespace Karalevha.API.Services
{
    /// <summary>
    /// Oba sohbetlerinde paylaşılan dosyaların diskteki yeri.
    /// Dosyalar bilerek wwwroot dışında tutulur: gizli obaların dosyaları
    /// statik sunucudan değil, yetki kontrolü yapan controller'dan geçmek zorunda.
    /// </summary>
    public class ObaFileStorage
    {
        public const long MaxFileSize = 25 * 1024 * 1024; // 25 MB

        // Sadece bu uzantılar kabul edilir (html, svg, exe gibi çalıştırılabilir içerik yok).
        private static readonly HashSet<string> AllowedExtensions = new(StringComparer.OrdinalIgnoreCase)
        {
            // Belgeler
            ".pdf", ".doc", ".docx", ".ppt", ".pptx", ".xls", ".xlsx", ".odt", ".ods", ".odp", ".txt", ".md", ".csv", ".rtf",
            // Görseller
            ".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp",
            // Ses / video
            ".mp3", ".wav", ".ogg", ".mp4", ".webm",
            // Arşivler
            ".zip", ".rar", ".7z",
            // Maker / 3B / oyun / elektronik
            ".stl", ".3mf", ".obj", ".fbx", ".glb", ".blend", ".step", ".stp", ".gcode", ".dxf", ".f3d", ".fzz", ".kicad_pcb", ".kicad_sch", ".sch", ".brd",
            // Kod
            ".ino", ".c", ".cpp", ".h", ".hpp", ".py", ".js", ".ts", ".cs", ".java", ".json", ".xml", ".yaml", ".yml", ".ipynb"
        };

        private readonly FileExtensionContentTypeProvider _contentTypes = new();

        public string Root { get; }

        public ObaFileStorage(IConfiguration config, IWebHostEnvironment env)
        {
            Root = config["Storage:ObaFilesPath"] is { Length: > 0 } configured
                ? configured
                : Path.Combine(env.ContentRootPath, "App_Data", "oba-files");
            Directory.CreateDirectory(Root);
        }

        public static bool IsAllowed(string fileName) =>
            AllowedExtensions.Contains(Path.GetExtension(fileName));

        public string ContentTypeFor(string fileName) =>
            _contentTypes.TryGetContentType(fileName, out var type) ? type : "application/octet-stream";

        /// <summary>Kullanıcının verdiği addan asla yol üretme; sadece uzantısını al.</summary>
        public static string NewStoredName(string originalFileName) =>
            $"{Guid.NewGuid():N}{Path.GetExtension(originalFileName).ToLowerInvariant()}";

        public string PathFor(string storedName) =>
            Path.Combine(Root, Path.GetFileName(storedName));

        public void Delete(string? storedName)
        {
            if (string.IsNullOrEmpty(storedName)) return;
            var path = PathFor(storedName);
            if (File.Exists(path)) File.Delete(path);
        }
    }
}
