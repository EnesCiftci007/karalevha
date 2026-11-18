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
