namespace Karalevha.API.Services
{
    /// <summary>
    /// Oturum çerezi. Jeton tarayıcıda JavaScript'in okuyamadığı (HttpOnly) bir çerezde durur: sitede bir
    /// XSS açığı çıksa bile hesap anahtarı çalınamaz.
    ///
    /// Site ve API tarayıcıya aynı adres gibi görünür (canlıda Vercel /api, /uploads ve hub yollarını API'ye
    /// yönlendirir; geliştirmede localhost'un portları zaten aynı "site" sayılır), bu yüzden çerez birinci
    /// taraf çerezidir ve SameSite=Lax yeterlidir: başka bir siteden gelen form ya da istek çerezi taşımaz.
    /// Ek koruma olarak çerezle gelen değiştirici isteklerde X-KaraLevha başlığı aranır (CsrfGuard).
    /// </summary>
    public static class AuthCookie
    {
        public const string Name = "kl_oturum";
        public const string CsrfHeader = "X-KaraLevha";
        public static readonly TimeSpan Lifetime = TimeSpan.FromDays(7);

        public static void Set(HttpContext http, string token) =>
            http.Response.Cookies.Append(Name, token, Options(http, DateTimeOffset.UtcNow.Add(Lifetime)));

        public static void Clear(HttpContext http) =>
            http.Response.Cookies.Delete(Name, Options(http, null));

        private static CookieOptions Options(HttpContext http, DateTimeOffset? expires) => new()
        {
            HttpOnly = true,
            // Canlıda her zaman Secure: vekil sunucu ayarı (X-Forwarded-Proto) yanlış olsa da çerez şifresiz
            // bağlantıda gönderilmez. Yerelde ve testlerde http olduğu için isteğe göre.
            Secure = http.Request.IsHttps || http.RequestServices.GetService<IWebHostEnvironment>()?.IsProduction() == true,
            SameSite = SameSiteMode.Lax,
            Path = "/",
            Expires = expires,
            IsEssential = true,
        };

        /// <summary>
        /// Çerezle kimliği doğrulanan değiştirici isteklerde (POST/PUT/PATCH/DELETE) özel başlık zorunlu.
        /// Başka bir site bu başlığı CORS izni olmadan gönderemez; Authorization başlığıyla gelenler
        /// (araçlar, testler) çerez kullanmadığı için muaftır.
        /// </summary>
        public static IApplicationBuilder UseCsrfGuard(this IApplicationBuilder app) => app.Use(async (http, next) =>
        {
            var method = http.Request.Method;
            var changes = HttpMethods.IsPost(method) || HttpMethods.IsPut(method) || HttpMethods.IsPatch(method) || HttpMethods.IsDelete(method);
            if (changes && http.Request.Cookies.ContainsKey(Name) && !http.Request.Headers.ContainsKey("Authorization")
                && !http.Request.Headers.ContainsKey(CsrfHeader))
            {
                http.Response.StatusCode = StatusCodes.Status403Forbidden;
                await http.Response.WriteAsJsonAsync(new { message = "İstek reddedildi (eksik güvenlik başlığı). Sayfayı yenileyip yeniden dene." });
                return;
            }
            await next();
        });
    }
}
