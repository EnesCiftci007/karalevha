using System.Net.Http.Json;

namespace Karalevha.API.Tests;

[Collection(ApiCollection.Name)]
public class AuthTests(ApiFactory api)
{
    [Fact]
    public async Task Kayit_ve_giris()
    {
        var me = await TestClient.Register(api);
        Assert.True(me.Id > 0);
        var profile = await me.Get($"/api/users/{me.Username}");
        Assert.True(profile.Ok, profile.ToString());
    }

    [Fact]
    public async Task Yanlis_sifre_reddedilir()
    {
        var me = await TestClient.Register(api);
        var res = await api.CreateClient().PostAsJsonAsync("/api/auth/login", new { usernameOrEmail = me.Username, password = "yanlis-sifre-123" });
        Assert.Equal(401, (int)res.StatusCode);
    }

    private Task<HttpResponseMessage> Login(string login, string password, string? fakeIp = null)
    {
        var req = new HttpRequestMessage(HttpMethod.Post, "/api/auth/login")
        {
            Content = JsonContent.Create(new { usernameOrEmail = login, password })
        };
        if (fakeIp != null) req.Headers.Add("X-Forwarded-For", fakeIp);
        return api.CreateClient().SendAsync(req);
    }

    [Fact]
    public async Task Hesaba_cok_yanlis_sifre_girilince_ip_degisse_de_giris_kapanir()
    {
        var victim = await TestClient.Register(api);
        var other = await TestClient.Register(api);

        // Her denemede başka bir IP uyduruluyor: IP sınırı bunu yakalamaz, hesap sınırı yakalar
        for (var i = 0; i < 10; i++)
            Assert.Equal(401, (int)(await Login(victim.Username, "yanlis-" + i, $"203.0.113.{i + 1}")).StatusCode);

        var blocked = await Login(victim.Username, ApiFactory.Password, "198.51.100.7");
        Assert.Equal(429, (int)blocked.StatusCode);                       // doğru şifre de denenmez
        Assert.True(blocked.Headers.Contains("Retry-After"));
        Assert.Equal(429, (int)(await Login(victim.Username.ToUpperInvariant(), ApiFactory.Password)).StatusCode); // büyük/küçük harf aynı hesap

        Assert.Equal(200, (int)(await Login(other.Username, ApiFactory.Password)).StatusCode); // başka hesap etkilenmez
    }

    [Fact]
    public async Task Basarili_giris_yanlis_sayacini_sifirlar()
    {
        var me = await TestClient.Register(api);
        for (var i = 0; i < 9; i++) await Login(me.Username, "yanlis-" + i);
        Assert.Equal(200, (int)(await Login(me.Username, ApiFactory.Password)).StatusCode);
        for (var i = 0; i < 9; i++) await Login(me.Username, "yanlis-" + i);
        Assert.Equal(200, (int)(await Login(me.Username, ApiFactory.Password)).StatusCode);
    }

    [Fact]
    public async Task Yapilandirmadaki_yonetici_yonetici_olur()
    {
        var admin = await TestClient.Admin(api);
        var res = await admin.Get("/api/market/siparisler");
        Assert.True(res.Ok, res.ToString());
        var member = await TestClient.Register(api);
        Assert.Equal(403, (await member.Get("/api/market/siparisler")).Code);
    }
}
