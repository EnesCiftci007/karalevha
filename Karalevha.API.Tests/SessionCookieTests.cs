using System.IdentityModel.Tokens.Jwt;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Text;
using Microsoft.IdentityModel.Tokens;

namespace Karalevha.API.Tests;

/// <summary>Oturum HttpOnly çerezde; çerezle gelen değiştirici isteklerde güvenlik başlığı aranır</summary>
[Collection(ApiCollection.Name)]
public class SessionCookieTests(ApiFactory api)
{
    private async Task<(HttpClient Http, HttpResponseMessage Login)> LoggedIn()
    {
        var me = await TestClient.Register(api);
        var http = api.CreateClient(); // başlıksız, çerezli
        var login = await http.PostAsJsonAsync("/api/auth/login", new { usernameOrEmail = me.Username, password = ApiFactory.Password });
        return (http, login);
    }

    [Fact]
    public async Task Giris_jetonu_govdede_degil_HttpOnly_cerezde()
    {
        var (_, login) = await LoggedIn();
        Assert.True(login.IsSuccessStatusCode);
        var body = await login.Content.ReadAsStringAsync();
        Assert.DoesNotContain("token", body);

        var cookie = login.Headers.GetValues("Set-Cookie").Single(c => c.StartsWith("kl_oturum="));
        Assert.Contains("httponly", cookie.ToLowerInvariant());
        Assert.Contains("samesite=lax", cookie.ToLowerInvariant());
        Assert.Contains("path=/", cookie.ToLowerInvariant());
    }

    [Fact]
    public async Task Cerezle_okuma_serbest_degistirme_basliksiz_reddedilir()
    {
        var (http, _) = await LoggedIn();
        Assert.True((await http.GetAsync("/api/auth/me")).IsSuccessStatusCode);

        var withoutHeader = await http.PostAsJsonAsync("/api/projects", new { title = "x", description = "y", category = "diger" });
        Assert.Equal(403, (int)withoutHeader.StatusCode);

        var req = new HttpRequestMessage(HttpMethod.Post, "/api/projects") { Content = JsonContent.Create(new { title = "x", description = "y", category = "diger" }) };
        req.Headers.Add("X-KaraLevha", "1");
        Assert.True((await http.SendAsync(req)).IsSuccessStatusCode);
    }

    [Fact]
    public async Task Cikis_cerezi_siler()
    {
        var me = await TestClient.Register(api);
        Assert.True((await me.Get("/api/auth/me")).Ok);
        Assert.True((await me.Post("/api/auth/logout")).Ok);
        Assert.Equal(401, (await me.Get("/api/auth/me")).Code);
    }

    [Fact]
    public async Task Eski_jetonla_oturum_cereze_tasinir()
    {
        var me = await TestClient.Register(api);
        // Eski sürümün localStorage'da tuttuğu türden bir jeton
        var legacy = new JwtSecurityTokenHandler().WriteToken(new JwtSecurityToken(
            issuer: "Karalevha.API", audience: "Karalevha.Client",
            claims: new[] { new Claim(ClaimTypes.NameIdentifier, me.Id.ToString()), new Claim(ClaimTypes.Name, me.Username), new Claim(ClaimTypes.Role, "User") },
            expires: DateTime.UtcNow.AddHours(1),
            signingCredentials: new SigningCredentials(new SymmetricSecurityKey(Encoding.UTF8.GetBytes(ApiFactory.JwtKey)), SecurityAlgorithms.HmacSha256)));

        var http = api.CreateClient();
        var move = new HttpRequestMessage(HttpMethod.Post, "/api/auth/oturum-tasi");
        move.Headers.Authorization = new AuthenticationHeaderValue("Bearer", legacy);
        var res = await http.SendAsync(move);
        Assert.True(res.IsSuccessStatusCode, await res.Content.ReadAsStringAsync());
        Assert.Contains(res.Headers.GetValues("Set-Cookie"), c => c.StartsWith("kl_oturum="));

        // Artık başlıksız, yalnızca çerezle
        var me2 = await http.GetAsync("/api/auth/me");
        Assert.True(me2.IsSuccessStatusCode);

        // Jetonsuz taşıma isteği reddedilir
        Assert.Equal(401, (int)(await api.CreateClient().PostAsync("/api/auth/oturum-tasi", null)).StatusCode);
    }
}
