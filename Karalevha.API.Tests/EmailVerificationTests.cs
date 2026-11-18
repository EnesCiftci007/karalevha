using System.Net.Http.Json;
using System.Text.Json.Nodes;
using Microsoft.EntityFrameworkCore;

namespace Karalevha.API.Tests;

/// <summary>Auth:RequireEmailVerification açıkken kayıt, doğrulama ve yeniden gönderim</summary>
[Collection(ApiCollection.Name)]
public class EmailVerificationTests(ApiFactory api)
{
    private const string Flag = "Auth:RequireEmailVerification";

    private static string NewName() => "t_" + Guid.NewGuid().ToString("N")[..10];

    private async Task<Response> Post(string path, object body) =>
        await Response.From(await api.CreateClient().PostAsJsonAsync(path, body));

    private Task<Response> Register(string username, string email) =>
        Post("/api/auth/register", new { username, email, password = ApiFactory.Password });

    private Task<Response> Login(string username) =>
        Post("/api/auth/login", new { usernameOrEmail = username, password = ApiFactory.Password });

    [Fact]
    public async Task Dogrulanmadan_giris_yapilamaz_baglantiyla_acilir()
    {
        using var _ = api.Settings.Scoped(Flag, "true");
        var name = NewName();
        var email = $"{name}@example.test";

        var reg = await Register(name, email);
        Assert.True(reg.Ok, reg.ToString());
        Assert.True(reg["requiresVerification"].GetValue<bool>());

        var blocked = await Login(name);
        Assert.Equal(403, blocked.Code);
        Assert.True(blocked["requiresVerification"].GetValue<bool>());

        var token = api.Email.LastToken(email);
        Assert.Equal(400, (await Post("/api/auth/verify-email", new { email, token = token + "x" })).Code);
        Assert.True((await Post("/api/auth/verify-email", new { email, token })).Ok);
        Assert.True((await Login(name)).Ok);

        // Bağlantı ikinci kez açılırsa da sorun çıkmaz
        Assert.True((await Post("/api/auth/verify-email", new { email, token })).Ok);
    }

    [Fact]
    public async Task Veritabaninda_kodun_kendisi_degil_ozeti_durur()
    {
        using var _ = api.Settings.Scoped(Flag, "true");
        var name = NewName();
        var email = $"{name}@example.test";
        await Register(name, email);
        var token = api.Email.LastToken(email);

        using var db = api.NewDb();
        var stored = await db.Users.Where(u => u.Email == email).Select(u => u.EmailVerificationToken).SingleAsync();
        Assert.NotNull(stored);
        Assert.NotEqual(token, stored);
        Assert.Equal(64, stored!.Length); // SHA-256, hex
    }

    [Fact]
    public async Task Suresi_dolmus_baglanti_gecersiz_yenisi_istenebilir()
    {
        using var _ = api.Settings.Scoped(Flag, "true");
        var name = NewName();
        var email = $"{name}@example.test";
        await Register(name, email);
        var token = api.Email.LastToken(email);

        using (var db = api.NewDb())
            await db.Users.Where(u => u.Email == email)
                .ExecuteUpdateAsync(s => s.SetProperty(u => u.EmailVerificationTokenExpiresAt, DateTime.UtcNow.AddMinutes(-1)));

        Assert.Equal(400, (await Post("/api/auth/verify-email", new { email, token })).Code);
        Assert.True((await Post("/api/auth/resend-verification", new { email })).Ok);
        Assert.Equal(2, api.Email.SentTo(email).Count);
        Assert.True((await Post("/api/auth/verify-email", new { email, token = api.Email.LastToken(email) })).Ok);
    }

    [Fact]
    public async Task Art_arda_yeniden_gonderim_e_posta_yagdirmaz()
    {
        using var _ = api.Settings.Scoped(Flag, "true");
        var name = NewName();
        var email = $"{name}@example.test";
        await Register(name, email);

        var r1 = await Post("/api/auth/resend-verification", new { email });
        var r2 = await Post("/api/auth/resend-verification", new { email });
        Assert.True(r1.Ok && r2.Ok);
        Assert.Single(api.Email.SentTo(email)); // yalnızca kayıttaki e-posta

        // Kayıtlı olmayan adres de aynı yanıtı alır: adresin kayıtlı olduğu belli olmaz
        var unknown = await Post("/api/auth/resend-verification", new { email = "yok-" + email });
        Assert.Equal(r1["message"].GetValue<string>(), unknown["message"].GetValue<string>());
    }

    [Fact]
    public async Task Dogrulanmamis_hesap_adresi_suresi_dolunca_kilitlemez()
    {
        using var _ = api.Settings.Scoped(Flag, "true");
        var email = $"{NewName()}@example.test";
        var squatter = NewName();
        await Register(squatter, email);

        // Bağlantının süresi dolmadan adres kullanımda
        Assert.Equal(400, (await Register(NewName(), email)).Code);

        using (var db = api.NewDb())
            await db.Users.Where(u => u.Email == email)
                .ExecuteUpdateAsync(s => s.SetProperty(u => u.EmailVerificationTokenExpiresAt, DateTime.UtcNow.AddMinutes(-1)));

        // Süresi dolunca adresin gerçek sahibi kayıt olabilir; eski doğrulanmamış hesap kalkar
        var owner = NewName();
        Assert.True((await Register(owner, email)).Ok);
        using var check = api.NewDb();
        Assert.False(await check.Users.AnyAsync(u => u.Username == squatter));
        Assert.True(await check.Users.AnyAsync(u => u.Username == owner));
    }

    [Fact]
    public async Task Dogrulanmis_hesap_silinmez()
    {
        var name = NewName(); // doğrulama kapalıyken açılan hesap doğrulanmış sayılır
        var email = $"{name}@example.test";
        Assert.True((await Register(name, email)).Ok);
        using var _ = api.Settings.Scoped(Flag, "true");
        Assert.Equal(400, (await Register(NewName(), email)).Code);
        Assert.True((await Login(name)).Ok);
    }
}
