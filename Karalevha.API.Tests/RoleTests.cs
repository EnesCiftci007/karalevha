using Karalevha.API.Models;
using Karalevha.API.Services;
using Microsoft.EntityFrameworkCore;

namespace Karalevha.API.Tests;

/// <summary>Owner/Admin yetkileri: kayıt rol vermez, tek seferlik kurulum, tek Owner, devir, rol düşürme</summary>
[Collection(ApiCollection.Name)]
public class RoleTests(ApiFactory api)
{
    private static Task<Response> Bootstrap(TestClient who, string token = ApiFactory.BootstrapToken) =>
        who.Post("/api/admin/owner-kurulum", new { token });

    private async Task<string?> RoleInDb(int id)
    {
        using var db = api.NewDb();
        return await db.Users.Where(u => u.Id == id).Select(u => u.Role).SingleAsync();
    }

    [Theory]
    [InlineData("sero")]    // eski yapılandırmadaki (henüz alınmamış) Owner adı
    [InlineData("owner")]
    [InlineData("admin")]
    public async Task Kayit_hicbir_adla_rol_vermez(string username)
    {
        var me = await TestClient.Register(api, username);
        Assert.Equal(Roles.User, await RoleInDb(me.Id));
        Assert.Equal(403, (await me.Get("/api/sikayetler")).Code);
        Assert.Equal(403, (await me.Post("/api/admin/set-role", new { userId = me.Id, role = "Admin" })).Code);
    }

    [Fact]
    public async Task Kurulum_tek_seferlik_yanlis_anahtar_gecmez()
    {
        await api.ClearOwnerAsync();
        var first = await TestClient.Register(api);
        var second = await TestClient.Register(api);

        Assert.False((await first.Get("/api/admin/owner-durumu"))["hasOwner"].GetValue<bool>());
        Assert.Equal(403, (await Bootstrap(first, "yanlis-anahtar-yanlis-anahtar-yanlis-anahtar")).Code);
        Assert.Equal(Roles.User, await RoleInDb(first.Id));

        Assert.True((await Bootstrap(first)).Ok);
        Assert.Equal(Roles.Owner, await RoleInDb(first.Id));
        Assert.Equal(409, (await Bootstrap(second)).Code);           // ikinci kez çalışmaz
        Assert.Equal(Roles.User, await RoleInDb(second.Id));
        Assert.Equal(401, (await Bootstrap(TestClient.Guest(api))).Code);
    }

    [Fact]
    public async Task Esszamanli_iki_kurulumdan_yalnizca_biri_gecer()
    {
        for (var round = 0; round < 3; round++)
        {
            await api.ClearOwnerAsync();
            var a = await TestClient.Register(api);
            var b = await TestClient.Register(api);
            var results = await Task.WhenAll(Bootstrap(a), Bootstrap(b));
            Assert.Equal(1, results.Count(r => r.Ok));
            Assert.Equal(1, results.Count(r => r.Code == 409));
            using var db = api.NewDb();
            Assert.Equal(1, await db.Users.CountAsync(u => u.Role == Roles.Owner));
        }
    }

    [Fact]
    public async Task Veritabani_ikinci_Owneri_reddeder()
    {
        await api.ClearOwnerAsync();
        var a = await TestClient.Register(api);
        var b = await TestClient.Register(api);
        await api.SetRoleAsync(a.Username, Roles.Owner);

        using var db = api.NewDb();
        var other = await db.Users.SingleAsync(u => u.Id == b.Id);
        other.Role = Roles.Owner;
        await Assert.ThrowsAsync<DbUpdateException>(() => db.SaveChangesAsync());
    }

    [Fact]
    public async Task Owner_devri_atomik_eski_Owner_Admin_olur()
    {
        await api.ClearOwnerAsync();
        var owner = await TestClient.Register(api);
        var heir = await TestClient.Register(api);
        await api.SetRoleAsync(owner.Username, Roles.Owner);

        Assert.Equal(400, (await owner.Post("/api/admin/owner-devret", new { userId = heir.Id, password = "yanlis-sifre-1" })).Code);
        Assert.Equal(403, (await heir.Post("/api/admin/owner-devret", new { userId = heir.Id, password = ApiFactory.Password })).Code);

        Assert.True((await owner.Post("/api/admin/owner-devret", new { userId = heir.Id, password = ApiFactory.Password })).Ok);
        Assert.Equal(Roles.Owner, await RoleInDb(heir.Id));
        Assert.Equal(Roles.Admin, await RoleInDb(owner.Id));
        using (var db = api.NewDb())
            Assert.Equal(1, await db.Users.CountAsync(u => u.Role == Roles.Owner));

        // Eski Owner artık rol dağıtamaz ve devredemez; yeni Owner dağıtabilir
        Assert.Equal(403, (await owner.Post("/api/admin/set-role", new { userId = heir.Id, role = "User" })).Code);
        Assert.Equal(403, (await owner.Post("/api/admin/owner-devret", new { userId = owner.Id, password = ApiFactory.Password })).Code);
        Assert.True((await heir.Post("/api/admin/set-role", new { userId = owner.Id, role = "User" })).Ok);
    }

    [Fact]
    public async Task Admin_Owner_atayamaz_Ownera_dokunamaz()
    {
        await api.ClearOwnerAsync();
        var owner = await TestClient.Register(api);
        var admin = await TestClient.Register(api);
        var user = await TestClient.Register(api);
        await api.SetRoleAsync(owner.Username, Roles.Owner);
        await api.SetRoleAsync(admin.Username, Roles.Admin);

        Assert.Equal(403, (await admin.Post("/api/admin/set-role", new { userId = user.Id, role = "Admin" })).Code);
        Assert.Equal(400, (await owner.Post("/api/admin/set-role", new { userId = user.Id, role = "Owner" })).Code);
        Assert.Equal(403, (await admin.Post("/api/admin/ban-user", new { userId = owner.Id, durationHours = 1 })).Code);
        Assert.Equal(403, (await admin.Post("/api/admin/owner-devret", new { userId = admin.Id, password = ApiFactory.Password })).Code);
        Assert.Equal(400, (await owner.Post("/api/auth/hesabi-sil", new { password = ApiFactory.Password })).Code);
    }

    [Fact]
    public async Task Rolu_alinan_hemen_erisimini_kaybeder()
    {
        await api.ClearOwnerAsync();
        var owner = await TestClient.Register(api);
        var x = await TestClient.Register(api);
        await api.SetRoleAsync(owner.Username, Roles.Owner);

        Assert.True((await owner.Post("/api/admin/set-role", new { userId = x.Id, role = "Admin" })).Ok);
        Assert.True((await x.Get("/api/sikayetler")).Ok);              // aynı oturumla yönetici
        Assert.True((await owner.Post("/api/admin/set-role", new { userId = x.Id, role = "User" })).Ok);
        Assert.Equal(403, (await x.Get("/api/sikayetler")).Code);      // aynı oturum, rol gitti
    }

    [Fact]
    public async Task Yeniden_baslatinca_roller_veritabanindan_aynen_yuklenir()
    {
        await api.ClearOwnerAsync();
        var owner = await TestClient.Register(api);
        var admin = await TestClient.Register(api);
        await api.SetRoleAsync(owner.Username, Roles.Owner);
        await api.SetRoleAsync(admin.Username, Roles.Admin);

        // Yeni bir süreç gibi: boş önbellekle veritabanından yükle
        var fresh = new CurrentUser();
        using var db = api.NewDb();
        await fresh.LoadAsync(db);
        Assert.Equal(Roles.Owner, fresh.RoleOf(owner.Username));
        Assert.Equal(Roles.Admin, fresh.RoleOf(admin.Username));
        Assert.Equal(Roles.User, fresh.RoleOf("sero"));
        // Yükleme hiçbir rolü değiştirmez
        Assert.Equal(Roles.Owner, await RoleInDb(owner.Id));
    }
}
