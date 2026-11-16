using Microsoft.AspNetCore.StaticFiles;

namespace Karalevha.API.Services
{
    /// <summary>
    /// Oba sohbetlerinde paylaşılan dosyalar: kabul kuralları ve depodaki yerleri ("oba-files/{ad}").
    /// Dosyalar bilerek herkese açık /uploads dışında tutulur: gizli obaların dosyaları
    /// yetki kontrolü yapan controller'dan geçmek zorunda.
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

        private readonly IFileStore _store;

        public ObaFileStorage(IFileStore store)
        {
            _store = store;
        }

        public static bool IsAllowed(string fileName) =>
            AllowedExtensions.Contains(Path.GetExtension(fileName));

        public string ContentTypeFor(string fileName) =>
            _contentTypes.TryGetContentType(fileName, out var type) ? type : "application/octet-stream";

        /// <summary>Kullanıcının verdiği addan asla yol üretme; sadece uzantısını al.</summary>
        public static string NewStoredName(string originalFileName) =>
            $"{Guid.NewGuid():N}{Path.GetExtension(originalFileName).ToLowerInvariant()}";

        private static string KeyOf(string storedName) => $"oba-files/{Path.GetFileName(storedName)}";

        public Task SaveAsync(string storedName, Stream content, string contentType) =>
            _store.SaveAsync(KeyOf(storedName), content, contentType);

        public Task<StoredFile?> OpenAsync(string storedName, CancellationToken ct = default) =>
            FileKeys.IsValid(KeyOf(storedName)) ? _store.OpenAsync(KeyOf(storedName), ct) : Task.FromResult<StoredFile?>(null);

        /// <summary>Kayıt silindikten sonra dosyayı kaldırır; silinemezse kaydı geri almaya değmez</summary>
        public async Task DeleteAsync(string? storedName)
        {
            if (string.IsNullOrEmpty(storedName) || !FileKeys.IsValid(KeyOf(storedName))) return;
            try
            {
                await _store.DeleteAsync(KeyOf(storedName));
            }
            catch
            {
                // depo geçici olarak yanıt vermiyorsa artık dosya kalır, işlem bozulmaz
            }
        }
    }
}
