using Karalevha.API.Services;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Hosting;

namespace Karalevha.API.Tests;

/// <summary>Canlı ortam ayarları: çerez, sağlık uçları, yavaş mod, gizli dosyaların açık adresten okunamaması</summary>
[Collection(ApiCollection.Name)]
public class ProductionSecurityTests(ApiFactory api)
{
    private sealed class Env(string name) : IWebHostEnvironment
    {
        public string EnvironmentName { get; set; } = name;
        public string ApplicationName { get; set; } = "Karalevha.API";
        public string WebRootPath { get; set; } = "";
        public IFileProvider WebRootFileProvider { get; set; } = new NullFileProvider();
        public string ContentRootPath { get; set; } = "";
        public IFileProvider ContentRootFileProvider { get; set; } = new NullFileProvider();
    }

    private static string CookieFor(string environment, bool https)
    {
        var http = new DefaultHttpContext
        {
            RequestServices = new ServiceCollection().AddSingleton<IWebHostEnvironment>(new Env(environment)).BuildServiceProvider()
        };
        http.Request.IsHttps = https;
        AuthCookie.Set(http, "jeton");
        return http.Response.Headers.SetCookie.ToString().ToLowerInvariant();
    }

    [Fact]
    public void Canlida_oturum_cerezi_her_zaman_secure_httponly_lax()
    {
        // Vekil sunucu X-Forwarded-Proto göndermese de (istek http görünse de) canlıda Secure
        var prod = CookieFor(Environments.Production, https: false);
        Assert.Contains("secure", prod);
        Assert.Contains("httponly", prod);
        Assert.Contains("samesite=lax", prod);
        // Yerel geliştirmede http ile çalışabilsin
        Assert.DoesNotContain("secure", CookieFor(Environments.Development, https: false));
        Assert.Contains("secure", CookieFor(Environments.Development, https: true));
    }

    [Fact]
    public async Task Saglik_uclari_calisir_ve_ayrinti_vermez()
    {
        var http = api.CreateClient();
        var live = await http.GetAsync("/health");
        Assert.Equal(200, (int)live.StatusCode);
        var ready = await http.GetAsync("/health/hazir");
        Assert.Equal(200, (int)ready.StatusCode);
        Assert.Equal("Healthy", await ready.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task Yavas_mod_429_doner()
    {
        var owner = await TestClient.Register(api);
        var oba = (await owner.Post("/api/obalar", new { name = "Yavaş " + Guid.NewGuid().ToString("N")[..5], description = "x", color = "#d4ff3d" }))["id"].GetValue<int>();
        var channel = (await owner.Get($"/api/obachannels/{oba}")).Array.First(c => !c!["isPrivate"]!.GetValue<bool>())!["id"]!.GetValue<int>();
        Assert.True((await owner.Post($"/api/obamessages/{channel}", new { content = "bir" })).Ok);
        Assert.Equal(429, (await owner.Post($"/api/obamessages/{channel}", new { content = "iki" })).Code);
    }

    [Theory]
    [InlineData("/uploads/market/x.stl")]
    [InlineData("/uploads/oba-files/x.pdf")]
    [InlineData("/uploads/%2E%2E/market/x.stl")]
    public async Task Gizli_depolar_acik_adresten_okunamaz(string path)
    {
        var res = await api.CreateClient().GetAsync(path);
        Assert.Equal(404, (int)res.StatusCode);
    }
    // Market sipariş dosyasının yalnızca sahibine/yöneticiye açık olması: MarketTests (403/401 kontrolleri)
}
