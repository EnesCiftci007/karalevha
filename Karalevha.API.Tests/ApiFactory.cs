using Karalevha.API.Data;
using Karalevha.API.Services;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
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

    private readonly string _storageRoot = Path.Combine(Path.GetTempPath(), "karalevha-test-" + Guid.NewGuid().ToString("N")[..8]);

    public ApiFactory()
    {
        var connection = TestConnectionString();
        ResetDatabase(connection);

        // Program, ayarları builder kurulurken okur: ortam değişkenleri en erken ve en güvenilir yol
        var settings = new Dictionary<string, string>
        {
            ["ConnectionStrings__DefaultConnection"] = connection,
            ["Jwt__Key"] = "test-anahtari-en-az-otuz-iki-bayt-uzunlugunda-0123456789",
            ["Jwt__Issuer"] = "Karalevha.API",
            ["Jwt__Audience"] = "Karalevha.Client",
            ["Admins__0"] = AdminName,
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
