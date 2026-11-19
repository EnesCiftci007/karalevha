using System.Text.RegularExpressions;
using Amazon.Runtime;
using Amazon.S3;
using Amazon.S3.Model;

namespace Karalevha.API.Services
{
    /// <summary>Depodan okunan dosya</summary>
    public sealed record StoredFile(Stream Content, long? Length);

    /// <summary>
    /// Yüklenen bütün dosyaların (model, fotoğraf, proje dosyası, oba dosyası, sipariş dosyası) deposu.
    /// Anahtarlar "uploads/models/{guid}.stl", "oba-files/{guid}.pdf", "market/{guid}.dxf" biçimindedir.
    ///
    /// "uploads/..." herkese açıktır ve /uploads/... adresinden sunulur (UploadsEndpoint);
    /// "oba-files/" ve "market/" yalnızca yetki denetleyen controller'lardan okunur.
    ///
    /// Storage:Provider = "s3" ise S3 uyumlu bir nesne deposu (Cloudflare R2, AWS S3, MinIO),
    /// değilse yerel disk kullanılır. Konteyner diski kalıcı olmadığı için canlıda s3 ya da
    /// kalıcı diske bağlanmış Storage:LocalRoot gerekir.
    /// </summary>
    public interface IFileStore
    {
        Task SaveAsync(string key, Stream content, string contentType, CancellationToken ct = default);
        /// <summary>Dosya yoksa null</summary>
        Task<StoredFile?> OpenAsync(string key, CancellationToken ct = default);
        /// <summary>Dosyanın bayt boyutunu içeriği indirmeden döner; yoksa null</summary>
        Task<long?> GetLengthAsync(string key, CancellationToken ct = default);
        /// <summary>Dosyayı depoda başka bir anahtara kopyalar (RAM tamponu olmadan); kaynak yoksa null, sınırı aşarsa -1</summary>
        Task<long?> CopyAsync(string sourceKey, string destKey, string contentType, long maxBytes, CancellationToken ct = default);
        Task DeleteAsync(string key, CancellationToken ct = default);
        Task<bool> ExistsAsync(string key, CancellationToken ct = default);
    }

    public static class FileKeys
    {
        private static readonly Regex Safe = new(@"^(uploads|oba-files|market)(/[A-Za-z0-9_\-]+)*/[A-Za-z0-9_\-]+(\.[A-Za-z0-9_]+)?$", RegexOptions.Compiled);

        /// <summary>Anahtar yalnızca bilinen kök klasörlerde, düz adlardan oluşur: yol saldırısı olmaz</summary>
        public static bool IsValid(string? key) => key != null && key.Length <= 300 && !key.Contains("..") && Safe.IsMatch(key);

        public static string Require(string key) =>
            IsValid(key) ? key : throw new ArgumentException($"Geçersiz dosya anahtarı: {key}");

        /// <summary>Veritabanındaki "/uploads/models/x.stl" yolunu anahtara çevirir</summary>
        public static string? FromPublicPath(string? path)
        {
            var key = path?.TrimStart('/');
            return key != null && key.StartsWith("uploads/") && IsValid(key) ? key : null;
        }

        /// <summary>Kullanıcının verdiği addan yalnızca uzantı alınır; ad GUID'dir</summary>
        public static string NewName(string originalFileName) =>
            $"{Guid.NewGuid():N}{Path.GetExtension(originalFileName).ToLowerInvariant()}";
    }

    /// <summary>Yerel disk. Geliştirmede ve kalıcı disk bağlanmış sunucularda.</summary>
    public sealed class LocalFileStore : IFileStore
    {
        private readonly string? _root;
        private readonly string _webRoot;
        private readonly string _obaFiles;
        private readonly string _market;

        public LocalFileStore(IConfiguration config, IWebHostEnvironment env)
        {
            // Storage:LocalRoot verilirse bütün anahtarlar onun altında (kalıcı disk)
            _root = config["Storage:LocalRoot"] is { Length: > 0 } root ? Path.GetFullPath(root) : null;
            // Verilmezse eski yerleşim: herkese açıklar wwwroot'ta, gizliler App_Data'da
            _webRoot = Path.GetFullPath(env.WebRootPath ?? Path.Combine(env.ContentRootPath, "wwwroot"));
            _obaFiles = Path.GetFullPath(config["Storage:ObaFilesPath"] is { Length: > 0 } o ? o : Path.Combine(env.ContentRootPath, "App_Data", "oba-files"));
            _market = Path.GetFullPath(config["Storage:MarketFilesPath"] is { Length: > 0 } m ? m : Path.Combine(env.ContentRootPath, "App_Data", "market"));
        }

        private string PathOf(string key)
        {
            FileKeys.Require(key);
            string baseDir, rest;
            if (_root != null) (baseDir, rest) = (_root, key);
            else if (key.StartsWith("uploads/")) (baseDir, rest) = (_webRoot, key);
            else if (key.StartsWith("oba-files/")) (baseDir, rest) = (_obaFiles, key["oba-files/".Length..]);
            else (baseDir, rest) = (_market, key["market/".Length..]);

            var full = Path.GetFullPath(Path.Combine(baseDir, rest.Replace('/', Path.DirectorySeparatorChar)));
            if (!full.StartsWith(baseDir + Path.DirectorySeparatorChar)) throw new ArgumentException("Geçersiz dosya yolu.");
            return full;
        }

        public async Task SaveAsync(string key, Stream content, string contentType, CancellationToken ct = default)
        {
            var path = PathOf(key);
            Directory.CreateDirectory(Path.GetDirectoryName(path)!);
            await using var file = new FileStream(path, FileMode.CreateNew);
            await content.CopyToAsync(file, ct);
        }

        public Task<StoredFile?> OpenAsync(string key, CancellationToken ct = default)
        {
            var path = PathOf(key);
            if (!File.Exists(path)) return Task.FromResult<StoredFile?>(null);
            var stream = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.Read, 64 * 1024, useAsync: true);
            return Task.FromResult<StoredFile?>(new StoredFile(stream, stream.Length));
        }

        public Task<long?> GetLengthAsync(string key, CancellationToken ct = default)
        {
            var path = PathOf(key);
            return Task.FromResult<long?>(File.Exists(path) ? new FileInfo(path).Length : null);
        }

        public async Task<long?> CopyAsync(string sourceKey, string destKey, string contentType, long maxBytes, CancellationToken ct = default)
        {
            var src = PathOf(sourceKey);
            if (!File.Exists(src)) return null;
            var len = new FileInfo(src).Length;
            if (len == 0 || len > maxBytes) return -1;
            var dst = PathOf(destKey);
            Directory.CreateDirectory(Path.GetDirectoryName(dst)!);
            await using var input = new FileStream(src, FileMode.Open, FileAccess.Read, FileShare.Read, 64 * 1024, useAsync: true);
            await using var output = new FileStream(dst, FileMode.CreateNew, FileAccess.Write, FileShare.None, 64 * 1024, useAsync: true);
            await input.CopyToAsync(output, ct);
            return len;
        }

        public Task DeleteAsync(string key, CancellationToken ct = default)
        {
            var path = PathOf(key);
            if (File.Exists(path)) File.Delete(path);
            return Task.CompletedTask;
        }

        public Task<bool> ExistsAsync(string key, CancellationToken ct = default) => Task.FromResult(File.Exists(PathOf(key)));
    }

    /// <summary>S3 uyumlu nesne deposu: Cloudflare R2, AWS S3, MinIO, Backblaze B2…</summary>
    public sealed class S3FileStore : IFileStore, IDisposable
    {
        private readonly AmazonS3Client _client;
        private readonly string _bucket;

        public S3FileStore(IConfiguration config)
        {
            var s = config.GetSection("Storage:S3");
            _bucket = s["Bucket"] ?? throw new InvalidOperationException("Storage:S3:Bucket tanımlı değil.");
            var cfg = new AmazonS3Config
            {
                ServiceURL = s["ServiceUrl"] ?? throw new InvalidOperationException("Storage:S3:ServiceUrl tanımlı değil."),
                AuthenticationRegion = s["Region"] is { Length: > 0 } region ? region : "auto",
                ForcePathStyle = true,
                // R2 ve MinIO, SDK'nın yeni varsayılan sağlama toplamlarını her zaman desteklemiyor
                RequestChecksumCalculation = RequestChecksumCalculation.WHEN_REQUIRED,
                ResponseChecksumValidation = ResponseChecksumValidation.WHEN_REQUIRED,
            };
            _client = new AmazonS3Client(
                new BasicAWSCredentials(
                    s["AccessKey"] ?? throw new InvalidOperationException("Storage:S3:AccessKey tanımlı değil."),
                    s["SecretKey"] ?? throw new InvalidOperationException("Storage:S3:SecretKey tanımlı değil.")),
                cfg);
        }

        public async Task SaveAsync(string key, Stream content, string contentType, CancellationToken ct = default)
        {
            await _client.PutObjectAsync(new PutObjectRequest
            {
                BucketName = _bucket,
                Key = FileKeys.Require(key),
                InputStream = content,
                ContentType = contentType,
                AutoCloseStream = false,
                UseChunkEncoding = false,
            }, ct);
        }

        public async Task<StoredFile?> OpenAsync(string key, CancellationToken ct = default)
        {
            try
            {
                var res = await _client.GetObjectAsync(_bucket, FileKeys.Require(key), ct);
                return new StoredFile(new S3Stream(res), res.ContentLength);
            }
            catch (AmazonS3Exception e) when (e.StatusCode == System.Net.HttpStatusCode.NotFound)
            {
                return null;
            }
        }

        public async Task<long?> GetLengthAsync(string key, CancellationToken ct = default)
        {
            try
            {
                var meta = await _client.GetObjectMetadataAsync(_bucket, FileKeys.Require(key), ct);
                return meta.ContentLength;
            }
            catch (AmazonS3Exception e) when (e.StatusCode == System.Net.HttpStatusCode.NotFound)
            {
                return null;
            }
        }

        public async Task<long?> CopyAsync(string sourceKey, string destKey, string contentType, long maxBytes, CancellationToken ct = default)
        {
            var len = await GetLengthAsync(sourceKey, ct);
            if (len == null) return null;
            if (len == 0 || len > maxBytes) return -1;
            await _client.CopyObjectAsync(new CopyObjectRequest
            {
                SourceBucket = _bucket,
                SourceKey = FileKeys.Require(sourceKey),
                DestinationBucket = _bucket,
                DestinationKey = FileKeys.Require(destKey),
                ContentType = contentType,
                MetadataDirective = S3MetadataDirective.REPLACE,
            }, ct);
            return len;
        }

        public async Task DeleteAsync(string key, CancellationToken ct = default) =>
            await _client.DeleteObjectAsync(_bucket, FileKeys.Require(key), ct);

        public async Task<bool> ExistsAsync(string key, CancellationToken ct = default)
        {
            try
            {
                await _client.GetObjectMetadataAsync(_bucket, FileKeys.Require(key), ct);
                return true;
            }
            catch (AmazonS3Exception e) when (e.StatusCode == System.Net.HttpStatusCode.NotFound)
            {
                return false;
            }
        }

        public void Dispose() => _client.Dispose();

        /// <summary>Yanıt akışı kapanınca S3 yanıtını da serbest bırakır</summary>
        private sealed class S3Stream(GetObjectResponse response) : Stream
        {
            private readonly Stream _inner = response.ResponseStream;
            public override bool CanRead => true;
            public override bool CanSeek => false;
            public override bool CanWrite => false;
            public override long Length => response.ContentLength;
            public override long Position { get => throw new NotSupportedException(); set => throw new NotSupportedException(); }
            public override int Read(byte[] buffer, int offset, int count) => _inner.Read(buffer, offset, count);
            public override Task<int> ReadAsync(byte[] buffer, int offset, int count, CancellationToken ct) => _inner.ReadAsync(buffer, offset, count, ct);
            public override ValueTask<int> ReadAsync(Memory<byte> buffer, CancellationToken ct = default) => _inner.ReadAsync(buffer, ct);
            public override void Flush() { }
            public override long Seek(long offset, SeekOrigin origin) => throw new NotSupportedException();
            public override void SetLength(long value) => throw new NotSupportedException();
            public override void Write(byte[] buffer, int offset, int count) => throw new NotSupportedException();
            protected override void Dispose(bool disposing)
            {
                if (disposing) response.Dispose();
                base.Dispose(disposing);
            }
        }
    }

    public static class FileStoreSetup
    {
        public static IServiceCollection AddFileStore(this IServiceCollection services, IConfiguration config)
        {
            if (string.Equals(config["Storage:Provider"], "s3", StringComparison.OrdinalIgnoreCase))
                services.AddSingleton<IFileStore, S3FileStore>();
            else
                services.AddSingleton<IFileStore, LocalFileStore>();
            return services;
        }

        /// <summary>
        /// "dotnet Karalevha.API.dll --depoya-aktar": eski yerel yerleşimdeki (wwwroot/uploads, App_Data)
        /// dosyaları yapılandırılmış depoya (ör. R2) kopyalar. Var olanları atlar; yerel dosyaları silmez.
        /// </summary>
        public static async Task<int> CopyLocalToStoreAsync(IServiceProvider services)
        {
            var store = services.GetRequiredService<IFileStore>();
            var local = new LocalFileStore(
                new ConfigurationBuilder().AddInMemoryCollection(
                    services.GetRequiredService<IConfiguration>().AsEnumerable()
                        .Where(kv => kv.Key is "Storage:ObaFilesPath" or "Storage:MarketFilesPath")).Build(),
                services.GetRequiredService<IWebHostEnvironment>());
            var env = services.GetRequiredService<IWebHostEnvironment>();
            var config = services.GetRequiredService<IConfiguration>();
            var webRoot = env.WebRootPath ?? Path.Combine(env.ContentRootPath, "wwwroot");
            var roots = new (string Dir, string Prefix)[]
            {
                (Path.Combine(webRoot, "uploads"), "uploads"),
                (config["Storage:ObaFilesPath"] is { Length: > 0 } o ? o : Path.Combine(env.ContentRootPath, "App_Data", "oba-files"), "oba-files"),
                (config["Storage:MarketFilesPath"] is { Length: > 0 } m ? m : Path.Combine(env.ContentRootPath, "App_Data", "market"), "market"),
            };

            int copied = 0, skipped = 0;
            foreach (var (dir, prefix) in roots)
            {
                if (!Directory.Exists(dir)) continue;
                foreach (var file in Directory.EnumerateFiles(dir, "*", SearchOption.AllDirectories))
                {
                    var key = $"{prefix}/{Path.GetRelativePath(dir, file).Replace(Path.DirectorySeparatorChar, '/')}";
                    if (!FileKeys.IsValid(key) || await store.ExistsAsync(key)) { skipped++; continue; }
                    var opened = await local.OpenAsync(key);
                    if (opened == null) { skipped++; continue; }
                    await using (opened.Content)
                        await store.SaveAsync(key, opened.Content, "application/octet-stream");
                    copied++;
                    Console.WriteLine($"kopyalandı: {key}");
                }
            }
            Console.WriteLine($"Bitti: {copied} dosya kopyalandı, {skipped} atlandı.");
            return 0;
        }
    }
}
