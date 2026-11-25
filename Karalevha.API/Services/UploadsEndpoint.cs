using Microsoft.AspNetCore.StaticFiles;

namespace Karalevha.API.Services
{
    /// <summary>
    /// Herkese açık yüklemeler (/uploads/...): modeller, baskı fotoğrafları, proje dosyaları.
    /// Dosya hangi depoda olursa olsun (yerel disk ya da R2/S3) aynı adresten sunulur; böylece
    /// veritabanındaki yollar ve istemci değişmez.
    /// </summary>
    public static class UploadsEndpoint
    {
        private static readonly FileExtensionContentTypeProvider Types = CreateTypes();

        private static FileExtensionContentTypeProvider CreateTypes()
        {
            var provider = new FileExtensionContentTypeProvider();
            // 3B model biçimleri
            foreach (var ext in new[] { ".stl", ".obj", ".fbx", ".3mf" })
                provider.Mappings[ext] = "application/octet-stream";
            provider.Mappings[".glb"] = "model/gltf-binary";
            // Proje dosyaları (CAD, devre, kod): görsel ve PDF kendi türüyle, kod düz metin, gerisi indirme olarak
            foreach (var ext in ProjectFileTypes.All)
                provider.Mappings[ext] = ProjectFileTypes.ContentTypeOf(ext);
            return provider;
        }

        /// <summary>Herkese açık yüklemelerin önbellek süresi: silinen dosya en geç bu süre sonra hiçbir yerden açılmaz</summary>
        public static readonly TimeSpan CacheFor = TimeSpan.FromDays(1);

        public static string ContentTypeOf(string fileName) =>
            Types.TryGetContentType(fileName, out var type) ? type : "application/octet-stream";

        public static IEndpointRouteBuilder MapUploads(this IEndpointRouteBuilder app)
        {
            app.MapMethods("/uploads/{**path}", new[] { "GET", "HEAD" }, async (string path, HttpContext http, IFileStore store) =>
            {
                var key = $"uploads/{path}";
                if (!FileKeys.IsValid(key)) return Results.NotFound();
                var file = await store.OpenAsync(key, http.RequestAborted);
                if (file == null) return Results.NotFound();

                var headers = http.Response.Headers;
                // Kullanıcı dosyası doğrudan açılırsa (ör. SVG) içindeki betik çalışmasın, tür tahmin edilmesin
                headers["X-Content-Type-Options"] = "nosniff";
                headers["Content-Security-Policy"] = "sandbox; default-src 'none'; img-src 'self'; style-src 'unsafe-inline'";
                // Adlar GUID, içerik değişmez; ama kişi dosyasını ya da hesabını silebilir (KVKK). Bir yıl
                // "immutable" saklanan bir kopya silindikten sonra da açılırdı: tarayıcı ve CDN en fazla bir gün tutar.
                headers.CacheControl = $"public, max-age={(int)CacheFor.TotalSeconds}";

                // Yerel dosyada kısmi indirme (Range) desteklenir; S3 akışı baştan sona gönderilir.
                // Boyut bilinsin: tarayıcı model yüklenirken ilerleme gösterebilsin
                if (!file.Content.CanSeek && file.Length is { } length) http.Response.ContentLength = length;
                return Results.Stream(file.Content, ContentTypeOf(path), enableRangeProcessing: file.Content.CanSeek);
            }).AllowAnonymous();
            return app;
        }
    }
}
