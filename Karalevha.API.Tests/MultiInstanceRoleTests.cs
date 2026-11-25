using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Karalevha.API.Data;
using Karalevha.API.Models;
using Karalevha.API.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.IdentityModel.Tokens;

namespace Karalevha.API.Tests;

/// <summary>
/// Aynı veritabanını kullanan iki API örneği (A ve B). Biri rol değiştirince öteki eski yetkiyi kullanamamalı.
/// </summary>
[Collection(ApiCollection.Name)]
public class MultiInstanceRoleTests(ApiFactory api)
{
    private static async Task<bool> Eventually(Func<Task<bool>> condition, int ms = 5000)
    {
        var until = DateTime.UtcNow.AddMilliseconds(ms);
        while (DateTime.UtcNow < until)
        {
            if (await condition()) return true;
            await Task.Delay(50);
        }
        return await condition();
    }

    private async Task<(TestClient Owner, TestClient X)> OwnerAndMember()
    {
        await api.ClearOwnerAsync();
        var owner = await TestClient.Register(api);
        var x = await TestClient.Register(api);
        await api.SetRoleAsync(owner.Username, Roles.Owner);
        return (owner, x);
    }

    [Fact]
    public async Task A_da_rol_kaldirilinca_B_hemen_reddeder()
    {
        var (owner, x) = await OwnerAndMember();
        using var b = api.SecondInstance();
        await api.WaitForRoleListenerAsync();
        await b.WaitForRoleListenerAsync();

        Assert.True((await owner.Post("/api/admin/set-role", new { userId = x.Id, role = "Admin" })).Ok); // A'da
        var xOnB = x.On(b);
        Assert.True(await Eventually(async () => (await xOnB.Get("/api/sikayetler")).Ok));
        Assert.True((await xOnB.Get("/api/sikayetler")).Ok); // B'nin önbelleğinde artık Admin

        Assert.True((await owner.Post("/api/admin/set-role", new { userId = x.Id, role = "User" })).Ok); // A'da
        // Önbellek süresi (60 sn) beklenmeden: B'ye NOTIFY ile haber gider
        Assert.True(await Eventually(async () => (await xOnB.Get("/api/sikayetler")).Code == 403, 3000));
        Assert.Equal(403, (await x.Get("/api/sikayetler")).Code); // A'da zaten
    }

    [Fact]
    public async Task B_de_verilen_rol_A_da_da_gecerli()
    {
        var (owner, x) = await OwnerAndMember();
        using var b = api.SecondInstance();
        await api.WaitForRoleListenerAsync();
        Assert.Equal(403, (await x.Get("/api/sikayetler")).Code); // A önbelleğe User yazdı

        Assert.True((await owner.On(b).Post("/api/admin/set-role", new { userId = x.Id, role = "Admin" })).Ok); // B'de
        Assert.True(await Eventually(async () => (await x.Get("/api/sikayetler")).Ok, 3000));
    }

    [Fact]
    public async Task Kurucu_devri_iki_ornekte_tutarli()
    {
        var (owner, x) = await OwnerAndMember();
        await api.SetRoleAsync(x.Username, Roles.Admin);
        using var b = api.SecondInstance();
        await b.WaitForRoleListenerAsync();
        var third = await TestClient.Register(api);
        Assert.True((await owner.On(b).Post("/api/admin/set-role", new { userId = third.Id, role = "User" })).Ok); // B: owner Owner

        Assert.True((await owner.Post("/api/admin/owner-devret", new { userId = x.Id, password = ApiFactory.Password })).Ok); // A'da devir
        // B'de eski kurucu artık rol değiştiremez, yenisi değiştirebilir
        Assert.True(await Eventually(async () =>
            (await owner.On(b).Post("/api/admin/set-role", new { userId = third.Id, role = "User" })).Code == 403, 3000));
        Assert.True((await x.On(b).Post("/api/admin/set-role", new { userId = third.Id, role = "User" })).Ok);
    }

    [Fact]
    public async Task Rol_okunamazsa_yetki_yukselmez()
    {
        // Veritabanına ulaşılamayan bir örnek: rol okunamaz → User
        var services = new ServiceCollection();
        services.AddDbContext<AppDbContext>(o => o.UseNpgsql("Host=127.0.0.1;Port=1;Database=yok;Username=x;Password=x;Timeout=2"));
        using var provider = services.BuildServiceProvider();
        var config = new ConfigurationBuilder().Build();
        var broken = new CurrentUser(provider.GetRequiredService<IServiceScopeFactory>(), config, NullLogger<CurrentUser>.Instance);

        var (owner, _) = await OwnerAndMember();
        Assert.Equal(Roles.User, await broken.GetRoleAsync(owner.Id));

        var principal = new ClaimsPrincipal(new ClaimsIdentity(new[] { new Claim(ClaimTypes.NameIdentifier, owner.Id.ToString()) }, "test"));
        await broken.AttachAsync(principal, default);
        Assert.False(broken.IsAdmin(principal));
        Assert.False(broken.IsOwner(principal));
    }

    [Fact]
    public async Task Dinleyici_yokken_onbellek_kullanilmaz()
    {
        var (owner, x) = await OwnerAndMember();
        await api.SetRoleAsync(x.Username, Roles.Admin);
        var roles = api.Service<CurrentUser>();
        await api.WaitForRoleListenerAsync();
        Assert.True((await x.Get("/api/sikayetler")).Ok); // önbellekte Admin

        roles.ListeningStopped(); // dinleme koptu: haber gelmeyebilir
        try
        {
            // Haber göndermeden, doğrudan veritabanında rol alınır (başka bir örnek NOTIFY gönderemedi gibi)
            using (var db = api.NewDb())
                await db.Users.Where(u => u.Id == x.Id).ExecuteUpdateAsync(s => s.SetProperty(u => u.Role, Roles.User));
            Assert.Equal(403, (await x.Get("/api/sikayetler")).Code); // önbellek değil veritabanı
        }
        finally
        {
            roles.ListeningStarted();
        }
    }

    [Fact]
    public async Task JWT_icindeki_rol_bilgisi_yetki_vermez()
    {
        var member = await TestClient.Register(api);
        // Sunucunun anahtarıyla imzalı ama içinde eski/sahte rol bilgisi taşıyan bir oturum
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(ApiFactory.JwtKey));
        var token = new JwtSecurityTokenHandler().WriteToken(new JwtSecurityToken(
            issuer: "Karalevha.API", audience: "Karalevha.Client",
            claims: new[]
            {
                new Claim(ClaimTypes.NameIdentifier, member.Id.ToString()),
                new Claim(ClaimTypes.Name, member.Username),
                new Claim(ClaimTypes.Role, Roles.Owner),
                new Claim("karalevha:db-role", Roles.Owner),
            },
            expires: DateTime.UtcNow.AddHours(1),
            signingCredentials: new SigningCredentials(key, SecurityAlgorithms.HmacSha256)));

        var http = new HttpClient(api.Server.CreateHandler()) { BaseAddress = api.Server.BaseAddress };
        http.DefaultRequestHeaders.Add("Cookie", "kl_oturum=" + token);
        var res = await http.GetAsync("/api/sikayetler");
        Assert.Equal(403, (int)res.StatusCode);
    }
}
