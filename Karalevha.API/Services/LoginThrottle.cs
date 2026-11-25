using Microsoft.Extensions.Caching.Memory;

namespace Karalevha.API.Services
{
    /// <summary>
    /// Hesap başına yanlış şifre sınırı. IP'ye göre sınır (AuthLimiter) tek başına yetmez: API'ye vekil
    /// sunucuyu atlayıp doğrudan gelen biri X-Forwarded-For başlığını uydurarak her denemede başka bir IP
    /// gösterebilir. Bu sınır IP'ye bakmaz; aynı kullanıcı adına/e-postaya art arda yanlış şifre girilince
    /// o hesap için girişi bir süre kapatır.
    ///
    /// Var olmayan adlar da sayılır (hangi adın kayıtlı olduğu bu yolla anlaşılmasın).
    /// Not: sayaç bu API sürecinin belleğindedir; birden fazla örnekte her örnek ayrı sayar.
    /// </summary>
    public class LoginThrottle
    {
        private readonly IMemoryCache _cache;
        private readonly int _maxFailures;
        private readonly TimeSpan _window;

        private sealed class Counter
        {
            public int Failures;
            public DateTime WindowEndsAt;
        }

        public LoginThrottle(IMemoryCache cache, IConfiguration config)
        {
            _cache = cache;
            _maxFailures = Math.Max(1, config.GetValue("Auth:MaxFailedLogins", 10));
            _window = TimeSpan.FromMinutes(Math.Max(1, config.GetValue("Auth:FailedLoginWindowMinutes", 15)));
        }

        private static string Key(string login) => "giris-hata:" + login;

        /// <summary>Bu hesap için giriş şu an kapalıysa ne zaman açılacağı</summary>
        public DateTime? BlockedUntil(string login)
        {
            if (_cache.TryGetValue(Key(login), out Counter? c) && c != null)
                lock (c)
                    if (c.Failures >= _maxFailures && c.WindowEndsAt > DateTime.UtcNow) return c.WindowEndsAt;
            return null;
        }

        public void Failed(string login)
        {
            var c = _cache.GetOrCreate(Key(login), e =>
            {
                e.AbsoluteExpirationRelativeToNow = _window;
                return new Counter { WindowEndsAt = DateTime.UtcNow + _window };
            })!;
            lock (c) c.Failures++;
        }

        public void Succeeded(string login) => _cache.Remove(Key(login));
    }
}
