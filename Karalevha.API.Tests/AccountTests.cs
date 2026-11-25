using System.Net.Http.Json;
using System.Text.Json.Nodes;
using Microsoft.EntityFrameworkCore;

namespace Karalevha.API.Tests;

/// <summary>Hesap silme ve "verilerimi indir" (KVKK)</summary>
[Collection(ApiCollection.Name)]
public class AccountTests(ApiFactory api)
{
    private static Task<Response> DeleteAccount(TestClient who, string password = ApiFactory.Password) =>
        who.Post("/api/auth/hesabi-sil", new { password });

    [Fact]
    public async Task Yanlis_sifreyle_silinmez_kurucu_silinemez()
    {
        var me = await TestClient.Register(api);
        Assert.Equal(400, (await DeleteAccount(me, "yanlis-sifre-1")).Code);
        Assert.True((await me.Get("/api/auth/me")).Ok);

        var owner = await TestClient.Register(api, ApiFactory.OwnerName);
        await api.SetRoleAsync(ApiFactory.OwnerName, Karalevha.API.Models.Roles.Owner);
        var res = await DeleteAccount(owner);
        Assert.Equal(400, res.Code);
        Assert.Contains("kurucu", res["message"].GetValue<string>());
    }

    [Fact]
    public async Task Silinen_hesabin_baska_cihazdaki_oturumu_calismaz()
    {
        var me = await TestClient.Register(api);
        // Aynı hesap başka bir cihazda da açık (aynı çerez): silme yalnızca bu tarayıcının çerezini siler
        var otherDevice = me.On(api);
        Assert.True((await DeleteAccount(me)).Ok);

        Assert.Equal(401, (await otherDevice.Get("/api/auth/me")).Code);
        Assert.Equal(401, (await otherDevice.Post("/api/posts", new { content = "silindikten sonra" })).Code);
        Assert.Equal(401, (await otherDevice.Post("/api/projects", new { title = "x", description = "x", category = "diger" })).Code);
    }

    [Fact]
    public async Task Hesap_ve_verileri_silinir_baskalarininki_kalir()
    {
        var me = await TestClient.Register(api);
        var other = await TestClient.Register(api);

        // Kendi projesi (ekipsiz): dosyası ve modeliyle
        var mine = (await me.Post("/api/projects", new { title = "Silinecek", description = "x", category = "diger" }))["id"].GetValue<int>();
        var fileUrl = (await me.Upload($"/api/projects/{mine}/dosyalar", "file", "a.step", TestFiles.Text("x"), new Dictionary<string, string> { ["kind"] = "cizim" }))["fileUrl"].GetValue<string>();
        await me.Upload("/api/printmodels", "file", "a.stl", TestFiles.Stl, new Dictionary<string, string> { ["title"] = "M", ["projectId"] = mine.ToString() });
        var modelUrl = (await me.Get($"/api/printmodels?projectId={mine}")).Array[0]!["fileUrl"]!.GetValue<string>();

        // Başkasının projesine yorum ve beğeni, gönderi, sipariş, ekipsiz oba
        var theirs = (await other.Post("/api/projects", new { title = "Kalacak", description = "x", category = "diger" }))["id"].GetValue<int>();
        await me.Post($"/api/yorum/project/{theirs}", new { content = "benim yorumum" });
        await me.Post($"/api/begeni/project/{theirs}");
        await me.Post("/api/posts", new { content = "benim gönderim" });
        var order = await me.Upload("/api/market/siparis", "file", "p.dxf", TestFiles.Text("0\nSECTION\n"), new Dictionary<string, string> { ["service"] = "lazer", ["material"] = "Akrilik 3 mm", ["quantity"] = "1" });
        var oba = (await me.Post("/api/obalar", new { name = "Yalnız oba " + Guid.NewGuid().ToString("N")[..5], description = "x", color = "#d4ff3d" }))["id"].GetValue<int>();

        string storedOrder;
        using (var before = api.NewDb())
            storedOrder = await before.MarketOrders.Where(o => o.Id == order["id"].GetValue<int>()).Select(o => o.StoredName).SingleAsync();
        Assert.True(File.Exists(api.StoragePath($"market/{storedOrder}")));

        var res = await DeleteAccount(me);
        Assert.True(res.Ok, res.ToString());

        Assert.Equal(401, (await me.Get("/api/auth/me")).Code);       // oturum kapandı
        var login = await api.CreateClient().PostAsJsonAsync("/api/auth/login", new { usernameOrEmail = me.Username, password = ApiFactory.Password });
        Assert.Equal(401, (int)login.StatusCode);

        using var db = api.NewDb();
        Assert.False(await db.Users.AnyAsync(u => u.Id == me.Id));
        Assert.False(await db.Projects.AnyAsync(p => p.Id == mine));
        Assert.False(await db.Obalar.AnyAsync(o => o.Id == oba));
        Assert.False(await db.Posts.AnyAsync(p => p.UserId == me.Id));
        Assert.False(await db.Comments.AnyAsync(c => c.UserId == me.Id));
        Assert.False(await db.Likes.AnyAsync(l => l.UserId == me.Id));
        Assert.False(await db.MarketOrders.AnyAsync(o => o.UserId == me.Id));
        Assert.True(await db.Projects.AnyAsync(p => p.Id == theirs));  // başkasınınki yerinde

        // Dosyalar depodan da gitti
        Assert.Equal(404, (int)(await other.Raw(fileUrl)).StatusCode);
        Assert.Equal(404, (int)(await other.Raw(modelUrl)).StatusCode);
        Assert.False(File.Exists(api.StoragePath($"market/{storedOrder}")));
    }

    [Fact]
    public async Task Ekibi_olan_proje_ve_uyesi_olan_oba_devredilir()
    {
        var me = await TestClient.Register(api);
        var heir = await TestClient.Register(api);
        var host = await TestClient.Register(api);

        var project = (await me.Post("/api/projects", new { title = "Ortak robot", description = "x", category = "robotik" }))["id"].GetValue<int>();
        await me.Post($"/api/projects/{project}/ekip", new { username = heir.Username });
        await me.Upload("/api/printmodels", "file", "a.stl", TestFiles.Stl, new Dictionary<string, string> { ["title"] = "Şasi", ["projectId"] = project.ToString() });

        var oba = (await me.Post("/api/obalar", new { name = "Ortak oba " + Guid.NewGuid().ToString("N")[..5], description = "x", color = "#d4ff3d" }))["id"].GetValue<int>();
        await heir.Post($"/api/obalar/{oba}/join", new { });

        // Başkasının projesine yüklediği model o projenin sahibine geçer
        var hostProject = (await host.Post("/api/projects", new { title = "Ev sahibi", description = "x", category = "diger" }))["id"].GetValue<int>();
        await host.Post($"/api/projects/{hostProject}/ekip", new { username = me.Username });
        await me.Upload("/api/printmodels", "file", "b.stl", TestFiles.Stl, new Dictionary<string, string> { ["title"] = "Parça", ["projectId"] = hostProject.ToString() });

        Assert.True((await DeleteAccount(me)).Ok);

        using var db = api.NewDb();
        var p = await db.Projects.SingleAsync(x => x.Id == project);
        Assert.Equal(heir.Id, p.UserId);
        Assert.False(await db.ProjectMembers.AnyAsync(m => m.ProjectId == project));
        Assert.Equal(heir.Id, (await db.PrintModels.SingleAsync(m => m.ProjectId == project)).UserId);
        Assert.Equal(heir.Id, (await db.Obalar.SingleAsync(o => o.Id == oba)).OwnerId);
        Assert.Equal(host.Id, (await db.PrintModels.SingleAsync(m => m.ProjectId == hostProject)).UserId);
        Assert.Contains((await heir.Get("/api/notifications")).Array, n => n!["text"]!.GetValue<string>().Contains("artık senin"));
    }

    [Fact]
    public async Task Verilerim_dosyasi_kisinin_verilerini_icerir()
    {
        var me = await TestClient.Register(api);
        await me.Post("/api/posts", new { content = "dışa aktarım testi" });
        var res = await me.Raw("/api/auth/verilerim");
        Assert.Equal(200, (int)res.StatusCode);
        Assert.Contains("attachment", res.Content.Headers.ContentDisposition?.ToString());
        var json = JsonNode.Parse(await res.Content.ReadAsStringAsync())!;
        Assert.Equal($"{me.Username}@example.test", json["hesap"]!["email"]!.GetValue<string>());
        Assert.Contains(json["gonderiler"]!.AsArray(), p => p!["content"]!.GetValue<string>() == "dışa aktarım testi");
        Assert.Equal(401, (int)(await TestClient.Guest(api).Raw("/api/auth/verilerim")).StatusCode);
    }
}
