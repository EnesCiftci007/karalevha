using Karalevha.API.Data;
using Karalevha.API.Services;
using System.Collections.Concurrent;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;

namespace Karalevha.API.Tests;

/// <summary>
/// Testlerin API'si: gerçek PostgreSQL üzerinde (PostgreSQL'e özgü sorgular ve migration'lar da sınansın),
/// her çalıştırmada sıfırdan kurulan ayrı bir test veritabanıyla.
///
/// Veritabanı: KARALEVHA_TEST_DB ortam değişkeni (CI bunu verir). Yoksa API'nin user-secrets'taki
/// bağlantısı alınır ve veritabanı adı karalevha_test yapılır; geliştirme verisine dokunulmaz.
/// </summary>
public sealed class ApiFactory : WebApplicationFactory<Program>
{
    public const string AdminName = "test_yonetici";
    public const string Password = "Test-Sifre-2026!";
    public const string JwtKey = "test-anahtari-en-az-otuz-iki-bayt-uzunlugunda-0123456789";

    /// <summary>Test sırasında değiştirilebilen ayarlar (ör. Auth:RequireEmailVerification)</summary>
    public Toggles Settings { get; } = new();

    /// <summary>Gönderilen e-postalar: gerçek e-posta yerine burada toplanır</summary>
    public FakeEmail Email { get; } = new();

    private readonly string _storageRoot = Path.Combine(Path.GetTempPath(), "karalevha-test-" + Guid.NewGuid().ToString("N")[..8]);

    public ApiFactory()
    {
        var connection = TestConnectionString();
        ResetDatabase(connection);

        // Program, ayarları builder kurulurken okur: ortam değişkenleri en erken ve en güvenilir yol
        var settings = new Dictionary<string, string>
        {
            ["ConnectionStrings__DefaultConnection"] = connection,
            ["Jwt__Key"] = JwtKey,
            ["Jwt__Issuer"] = "Karalevha.API",
            ["Jwt__Audience"] = "Karalevha.Client",
            ["Admins__0"] = AdminName,
            // Doğrulama bağlantısındaki site adresi
            ["Cors__Origins__0"] = "http://localhost:5173",
            ["RateLimits__Disabled"] = "true",
            ["Storage__Provider"] = "local",
            ["Storage__LocalRoot"] = _storageRoot,
        };
        foreach (var (key, value) in settings) Environment.SetEnvironmentVariable(key, value);
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        // "Testing": geliştiricinin user-secrets'ı (gerçek e-posta anahtarı vb.) yüklenmez
        builder.UseEnvironment("Testing");
        builder.ConfigureAppConfiguration(config => config.Add(Settings));
        builder.ConfigureTestServices(services =>
        {
            foreach (var d in services.Where(d => d.ServiceType == typeof(IEmailService)).ToList()) services.Remove(d);
            services.AddSingleton<IEmailService>(Email);
        });
    }

    /// <summary>Depodaki dosyanın diskteki yeri (yerel depo, Storage:LocalRoot)</summary>
    public string StoragePath(string key) => Path.Combine(_storageRoot, key.Replace('/', Path.DirectorySeparatorChar));

    public T Service<T>() where T : notnull => Services.GetRequiredService<T>();

    public AppDbContext NewDb() => Services.CreateScope().ServiceProvider.GetRequiredService<AppDbContext>();

    private static string TestConnectionString()
    {
        if (Environment.GetEnvironmentVariable("KARALEVHA_TEST_DB") is { Length: > 0 } fromEnv) return fromEnv;

        var secrets = new ConfigurationBuilder().AddUserSecrets("a5787341-5829-460d-8091-637a6db8469a").Build();
        var dev = secrets.GetConnectionString("DefaultConnection")
                  ?? throw new InvalidOperationException("Test veritabanı yok: KARALEVHA_TEST_DB ortam değişkenini verin.");
        return new NpgsqlConnectionStringBuilder(dev) { Database = "karalevha_test" }.ConnectionString;
    }

    /// <summary>Test veritabanını siler; API açılışta migration'larla yeniden kurar</summary>
    private static void ResetDatabase(string connection)
    {
        var target = new NpgsqlConnectionStringBuilder(connection);
        if (!target.Database!.Contains("test", StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException($"Güvenlik: test veritabanının adında 'test' geçmeli ({target.Database}).");

        var admin = new NpgsqlConnectionStringBuilder(connection) { Database = "postgres", Pooling = false };
        using var conn = new NpgsqlConnection(admin.ConnectionString);
        conn.Open();
        using var cmd = new NpgsqlCommand($"DROP DATABASE IF EXISTS \"{target.Database}\" WITH (FORCE)", conn);
        cmd.ExecuteNonQuery();
    }

    protected override void Dispose(bool disposing)
    {
        base.Dispose(disposing);
        try { if (Directory.Exists(_storageRoot)) Directory.Delete(_storageRoot, recursive: true); } catch { /* geçici klasör */ }
    }
}

/// <summary>Bütün testler tek API'yi ve tek veritabanını paylaşır, sırayla çalışır</summary>
[CollectionDefinition(Name)]
public sealed class ApiCollection : ICollectionFixture<ApiFactory>
{
    public const string Name = "api";
}

/// <summary>Çalışırken değiştirilebilen yapılandırma; istek anında okunan ayarlar için</summary>
public sealed class Toggles : ConfigurationProvider, IConfigurationSource
{
    public IConfigurationProvider Build(IConfigurationBuilder builder) => this;

    public void Set(string key, string? value)
    {
        if (value == null) Data.Remove(key); else Data[key] = value;
        OnReload();
    }

    /// <summary>using bloğu bitince ayar eski haline döner</summary>
    public IDisposable Scoped(string key, string value)
    {
        Set(key, value);
        return new Reset(() => Set(key, null));
    }

    private sealed class Reset(Action action) : IDisposable
    {
        public void Dispose() => action();
    }
}

/// <summary>Doğrulama bağlantılarını gönderilmiş gibi saklar</summary>
public sealed class FakeEmail : IEmailService
{
    private readonly ConcurrentDictionary<string, List<string>> _sent = new(StringComparer.OrdinalIgnoreCase);

    public Task SendVerificationEmailAsync(string toEmail, string verificationLink)
    {
        _sent.GetOrAdd(toEmail, _ => new List<string>()).Add(verificationLink);
        return Task.CompletedTask;
    }

    public IReadOnlyList<string> SentTo(string email) => _sent.TryGetValue(email, out var list) ? list : Array.Empty<string>();

    /// <summary>Son bağlantıdaki kod</summary>
    public string LastToken(string email)
    {
        var link = SentTo(email).Last();
        var query = System.Web.HttpUtility.ParseQueryString(new Uri(link).Query);
        return query["token"]!;
    }
}
