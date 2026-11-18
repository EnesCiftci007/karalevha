using System.Net;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Caching.Memory;

namespace Karalevha.API.Services
{
    /// <summary>
    /// Proje depolarını (GitHub, GitLab) okur: depo bilgisi, dosya ağacı ve dosya içeriği.
    /// Yalnızca github.com ve gitlab.com adreslerine istek atar (kullanıcının girdiği URL'den
    /// sahip/depo adı ayrıştırılır, adres olduğu gibi kullanılmaz). Sonuçlar önbelleğe alınır.
    /// İsteğe bağlı "GitHub:Token" ayarı, GitHub'ın kimliksiz istek sınırını (saatte 60) yükseltir.
    /// </summary>
    public class RepoService
    {
        public const long MaxTextBytes = 512 * 1024;      // bundan büyük metin dosyaları gösterilmez
        public const long MaxRawBytes = 15 * 1024 * 1024;  // görsel / 3B model aktarım sınırı
        private const int MaxTreeEntries = 3000;

        private static readonly TimeSpan TreeTtl = TimeSpan.FromMinutes(10);
        private static readonly TimeSpan FileTtl = TimeSpan.FromMinutes(30);

        private readonly HttpClient _http;
        private readonly IMemoryCache _cache;
        private readonly string? _githubToken;

        public RepoService(HttpClient http, IMemoryCache cache, IConfiguration config)
        {
            _http = http;
            _http.Timeout = TimeSpan.FromSeconds(15);
            _http.DefaultRequestHeaders.UserAgent.ParseAdd("KaraLevha-kod-goruntuleyici");
            _cache = cache;
            _githubToken = config["GitHub:Token"];
        }

        public record RepoRef(string Provider, string Path)
        {
            /// <summary>GitHub: "sahip/depo", GitLab: "grup/altgrup/depo"</summary>
            public string Name => Path;
        }

        public record RepoEntry(string Path, string Type, long? Size);

        public record RepoInfo(
            string Provider, string Name, string Branch, string? Description, int Stars, int Forks,
            string? Language, DateTime? UpdatedAt, string WebUrl, bool Truncated, List<RepoEntry> Files);

        public class RepoException : Exception
        {
            public int Status { get; }
            public RepoException(int status, string message) : base(message) => Status = status;
        }

        /// <summary>Depo adresini ayrıştırır; desteklenmiyorsa null.</summary>
        public static RepoRef? Parse(string url)
        {
            if (!Uri.TryCreate(url.Trim(), UriKind.Absolute, out var uri)) return null;
            if (uri.Scheme != Uri.UriSchemeHttps && uri.Scheme != Uri.UriSchemeHttp) return null;
            var host = uri.Host.ToLowerInvariant();
            var segments = uri.AbsolutePath.Split('/', StringSplitOptions.RemoveEmptyEntries).ToList();

            static bool Safe(string s) => s.Length is > 0 and <= 100 && s.All(c => char.IsLetterOrDigit(c) || c is '-' or '_' or '.') && s != "." && s != "..";

            if (host is "github.com" or "www.github.com")
            {
                if (segments.Count < 2) return null;
                var owner = segments[0];
                var repo = segments[1].EndsWith(".git", StringComparison.OrdinalIgnoreCase) ? segments[1][..^4] : segments[1];
                return Safe(owner) && Safe(repo) ? new RepoRef("github", $"{owner}/{repo}") : null;
            }
            if (host is "gitlab.com" or "www.gitlab.com")
            {
                // gitlab.com/grup/altgrup/depo/-/tree/main  ->  grup/altgrup/depo
                var stop = segments.IndexOf("-");
                var parts = (stop >= 0 ? segments.Take(stop) : segments).ToList();
                if (parts.Count < 2 || parts.Count > 6) return null;
                parts[^1] = parts[^1].EndsWith(".git", StringComparison.OrdinalIgnoreCase) ? parts[^1][..^4] : parts[^1];
                return parts.All(Safe) ? new RepoRef("gitlab", string.Join('/', parts)) : null;
            }
            return null;
        }

        private async Task<HttpResponseMessage> Send(RepoRef repo, string url, CancellationToken ct)
        {
            var req = new HttpRequestMessage(HttpMethod.Get, url);
            if (repo.Provider == "github" && url.StartsWith("https://api.github.com/"))
            {
                req.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/vnd.github+json"));
                if (!string.IsNullOrEmpty(_githubToken)) req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _githubToken);
            }
            HttpResponseMessage res;
            try
            {
                res = await _http.SendAsync(req, HttpCompletionOption.ResponseHeadersRead, ct);
            }
            catch (Exception e) when (e is HttpRequestException or TaskCanceledException)
            {
                throw new RepoException(502, "Depoya ulaşılamadı. İnternet bağlantısını kontrol edip tekrar dene.");
            }
            if (res.IsSuccessStatusCode) return res;

            var status = (int)res.StatusCode;
            res.Dispose();
            throw status switch
            {
                404 => new RepoException(404, "Depo bulunamadı ya da gizli. Kod görüntüleyici yalnızca herkese açık depoları gösterebilir."),
                403 or 429 => new RepoException(429, "Depo sağlayıcısının istek sınırı doldu. Birkaç dakika sonra tekrar dene."),
                _ => new RepoException(502, $"Depo okunamadı (sağlayıcı {status} döndü).")
            };
        }

        private async Task<JsonElement> GetJson(RepoRef repo, string url, CancellationToken ct)
        {
            using var res = await Send(repo, url, ct);
            await using var stream = await res.Content.ReadAsStreamAsync(ct);
            using var doc = await JsonDocument.ParseAsync(stream, cancellationToken: ct);
            return doc.RootElement.Clone();
        }

        static string? Str(JsonElement e, string name) => e.TryGetProperty(name, out var v) && v.ValueKind == JsonValueKind.String ? v.GetString() : null;
        static int Int(JsonElement e, string name) => e.TryGetProperty(name, out var v) && v.ValueKind == JsonValueKind.Number ? v.GetInt32() : 0;
        static DateTime? Date(JsonElement e, string name) => Str(e, name) is { } s && DateTime.TryParse(s, out var d) ? d.ToUniversalTime() : null;

        /// <summary>Depo bilgisi ve tam dosya ağacı (önbellekli).</summary>
        public Task<RepoInfo> GetInfo(RepoRef repo, CancellationToken ct) =>
            _cache.GetOrCreateAsync($"kod:agac:{repo.Provider}:{repo.Path}".ToLowerInvariant(), async entry =>
            {
                entry.AbsoluteExpirationRelativeToNow = TreeTtl;
                return repo.Provider == "github" ? await GitHubInfo(repo, ct) : await GitLabInfo(repo, ct);
            })!;

        private async Task<RepoInfo> GitHubInfo(RepoRef repo, CancellationToken ct)
        {
            var meta = await GetJson(repo, $"https://api.github.com/repos/{repo.Path}", ct);
            var branch = Str(meta, "default_branch") ?? "main";
            var tree = await GetJson(repo, $"https://api.github.com/repos/{repo.Path}/git/trees/{Uri.EscapeDataString(branch)}?recursive=1", ct);

            var files = new List<RepoEntry>();
            if (tree.TryGetProperty("tree", out var items))
                foreach (var item in items.EnumerateArray().Take(MaxTreeEntries))
                {
                    var type = Str(item, "type");
                    if (type is not ("blob" or "tree")) continue; // alt modüller (commit) atlanır
                    files.Add(new RepoEntry(Str(item, "path")!, type == "tree" ? "dir" : "file",
                        item.TryGetProperty("size", out var size) && size.ValueKind == JsonValueKind.Number ? size.GetInt64() : null));
                }
            var truncated = (tree.TryGetProperty("truncated", out var t) && t.ValueKind == JsonValueKind.True) || files.Count >= MaxTreeEntries;

            return new RepoInfo("github", repo.Path, branch, Str(meta, "description"), Int(meta, "stargazers_count"), Int(meta, "forks_count"),
                Str(meta, "language"), Date(meta, "pushed_at"), Str(meta, "html_url") ?? $"https://github.com/{repo.Path}", truncated, files);
        }

        private async Task<RepoInfo> GitLabInfo(RepoRef repo, CancellationToken ct)
        {
            var id = Uri.EscapeDataString(repo.Path);
            var meta = await GetJson(repo, $"https://gitlab.com/api/v4/projects/{id}", ct);
            var branch = Str(meta, "default_branch") ?? "main";

            var files = new List<RepoEntry>();
            var truncated = false;
            for (var page = 1; page <= MaxTreeEntries / 100; page++)
            {
                var items = await GetJson(repo, $"https://gitlab.com/api/v4/projects/{id}/repository/tree?recursive=true&per_page=100&page={page}&ref={Uri.EscapeDataString(branch)}", ct);
                var count = 0;
                foreach (var item in items.EnumerateArray())
                {
                    count++;
                    var type = Str(item, "type");
                    if (type is not ("blob" or "tree")) continue;
                    files.Add(new RepoEntry(Str(item, "path")!, type == "tree" ? "dir" : "file", null));
                }
                if (count < 100) break;
                if (page == MaxTreeEntries / 100) truncated = true;
            }

            return new RepoInfo("gitlab", repo.Path, branch, Str(meta, "description"), Int(meta, "star_count"), Int(meta, "forks_count"),
                null, Date(meta, "last_activity_at"), Str(meta, "web_url") ?? $"https://gitlab.com/{repo.Path}", truncated, files);
        }

        private static string RawUrl(RepoRef repo, string branch, string path)
        {
            var encodedPath = string.Join('/', path.Split('/').Select(Uri.EscapeDataString));
            return repo.Provider == "github"
                ? $"https://raw.githubusercontent.com/{repo.Path}/{Uri.EscapeDataString(branch)}/{encodedPath}"
                : $"https://gitlab.com/api/v4/projects/{Uri.EscapeDataString(repo.Path)}/repository/files/{Uri.EscapeDataString(path)}/raw?ref={Uri.EscapeDataString(branch)}";
        }

        /// <summary>
        /// Dosyanın ham baytları. Yol ağaçta yoksa 404 (yalnızca depodaki gerçek dosyalar okunur).
        /// </summary>
        public async Task<byte[]> GetRaw(RepoRef repo, string path, long limit, CancellationToken ct)
        {
            var info = await GetInfo(repo, ct);
            var entry = info.Files.FirstOrDefault(f => f.Type == "file" && f.Path == path)
                ?? throw new RepoException(404, "Dosya bulunamadı.");
            if (entry.Size > limit) throw new RepoException(413, "Dosya burada gösterilemeyecek kadar büyük.");

            var key = $"kod:dosya:{repo.Provider}:{repo.Path}:{info.Branch}:{path}".ToLowerInvariant();
            if (_cache.TryGetValue(key, out byte[]? cached) && cached != null) return cached;

            using var res = await Send(repo, RawUrl(repo, info.Branch, path), ct);
            if (res.Content.Headers.ContentLength > limit) throw new RepoException(413, "Dosya burada gösterilemeyecek kadar büyük.");
            await using var stream = await res.Content.ReadAsStreamAsync(ct);
            using var buffer = new MemoryStream();
            var chunk = new byte[81920];
            int read;
            while ((read = await stream.ReadAsync(chunk, ct)) > 0)
            {
                buffer.Write(chunk, 0, read);
                if (buffer.Length > limit) throw new RepoException(413, "Dosya burada gösterilemeyecek kadar büyük.");
            }
            var bytes = buffer.ToArray();
            // Yalnızca küçük dosyaları bellekte tut
            if (bytes.Length <= MaxTextBytes)
                _cache.Set(key, bytes, new MemoryCacheEntryOptions { AbsoluteExpirationRelativeToNow = FileTtl, Size = null });
            return bytes;
        }

        /// <summary>Baytlar metin mi? (NUL içermeyen, geçerli UTF-8)</summary>
        public static bool LooksLikeText(byte[] bytes)
        {
            var sample = bytes.AsSpan(0, Math.Min(bytes.Length, 8000));
            if (sample.IndexOf((byte)0) >= 0) return false;
            try
            {
                new UTF8Encoding(false, true).GetString(sample.Length < bytes.Length ? TrimIncomplete(sample) : sample);
                return true;
            }
            catch (DecoderFallbackException)
            {
                return false;
            }
        }

        // Örneğin sonunda yarım kalmış çok baytlı karakteri at
        private static ReadOnlySpan<byte> TrimIncomplete(ReadOnlySpan<byte> s)
        {
            var end = s.Length;
            for (var i = 0; i < 3 && end > 0 && (s[end - 1] & 0xC0) == 0x80; i++) end--;
            if (end > 0 && s[end - 1] >= 0xC0) end--;
            return s[..end];
        }
    }
}
