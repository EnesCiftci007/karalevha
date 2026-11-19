namespace Karalevha.API.Tests;

[Collection(ApiCollection.Name)]
public class TeamVersionTests(ApiFactory api)
{
    private static async Task<int> NewProject(TestClient owner) =>
        (await owner.Post("/api/projects", new { title = "Ekip projesi", description = "x", category = "robotik" }))["id"].GetValue<int>();

    private static Dictionary<string, string> Kind(string kind) => new() { ["kind"] = kind };

    [Fact]
    public async Task Sahip_ekip_kurar_uye_bildirim_alir_liste_doner()
    {
        var owner = await TestClient.Register(api);
        var member = await TestClient.Register(api);
        var id = await NewProject(owner);

        var added = await owner.Post($"/api/projects/{id}/ekip", new { username = "@" + member.Username });
        Assert.True(added.Ok, added.ToString());
        Assert.Equal(400, (await owner.Post($"/api/projects/{id}/ekip", new { username = member.Username })).Code); // zaten ekipte
        Assert.Equal(400, (await owner.Post($"/api/projects/{id}/ekip", new { username = owner.Username })).Code);  // sahip
        Assert.Equal(404, (await owner.Post($"/api/projects/{id}/ekip", new { username = "yok_boyle_biri_123" })).Code);

        var team = (await TestClient.Guest(api).Get($"/api/projects/{id}/ekip")).Array;
        Assert.Equal(new[] { "sahip", "uye" }, team.Select(m => m!["role"]!.GetValue<string>()));
        Assert.Contains(member.Id, (await owner.Get($"/api/projects/{id}"))["memberIds"].AsArray().Select(x => x!.GetValue<int>()));
        Assert.Contains((await member.Get("/api/notifications")).Array, n => n!["text"]!.GetValue<string>().Contains("ekibine ekledi"));
    }

    [Fact]
    public async Task Uye_ekleyebilir_ama_projeyi_yonetemez()
    {
        var owner = await TestClient.Register(api);
        var member = await TestClient.Register(api);
        var stranger = await TestClient.Register(api);
        var id = await NewProject(owner);
        await owner.Post($"/api/projects/{id}/ekip", new { username = member.Username });

        // Üye dosya ve model ekler; yabancı ekleyemez
        var file = await member.Upload($"/api/projects/{id}/dosyalar", "file", "sema.kicad_sch", TestFiles.Text("(kicad_sch)"), Kind("elektronik"));
        Assert.True(file.Ok, file.ToString());
        Assert.True((await member.Upload("/api/printmodels", "file", "kol.stl", TestFiles.Stl, new Dictionary<string, string> { ["title"] = "Kol", ["projectId"] = id.ToString() })).Ok);
        Assert.Equal(403, (await stranger.Upload($"/api/projects/{id}/dosyalar", "file", "x.step", TestFiles.Text("x"), Kind("cizim"))).Code);

        // Üye projeyi düzenleyemez, silemez, ekibe kimseyi ekleyemez
        Assert.Equal(403, (await member.Put($"/api/projects/{id}", new { title = "x", description = "y", category = "diger" })).Code);
        Assert.Equal(403, (await member.Delete($"/api/projects/{id}")).Code);
        Assert.Equal(403, (await member.Post($"/api/projects/{id}/ekip", new { username = stranger.Username })).Code);

        // Sahip, üyenin yüklediği dosyayı silebilir; üye kendininkini
        var ownersFile = await owner.Upload($"/api/projects/{id}/dosyalar", "file", "govde.step", TestFiles.Text("x"), Kind("cizim"));
        Assert.Equal(403, (await member.Delete($"/api/projects/{id}/dosyalar/{ownersFile["id"]}")).Code);
        Assert.True((await member.Delete($"/api/projects/{id}/dosyalar/{file["id"]}")).Ok);
        Assert.True((await owner.Delete($"/api/projects/{id}/dosyalar/{ownersFile["id"]}")).Ok);
    }

    [Fact]
    public async Task Uye_ayrilir_sahip_cikarir_baskasi_cikaramaz()
    {
        var owner = await TestClient.Register(api);
        var a = await TestClient.Register(api);
        var b = await TestClient.Register(api);
        var id = await NewProject(owner);
        await owner.Post($"/api/projects/{id}/ekip", new { username = a.Username });
        await owner.Post($"/api/projects/{id}/ekip", new { username = b.Username });

        Assert.Equal(403, (await a.Delete($"/api/projects/{id}/ekip/{b.Id}")).Code);
        Assert.True((await a.Delete($"/api/projects/{id}/ekip/{a.Id}")).Ok);       // kendisi ayrılır
        Assert.True((await owner.Delete($"/api/projects/{id}/ekip/{b.Id}")).Ok);   // sahip çıkarır
        Assert.Equal(403, (await b.Upload($"/api/projects/{id}/dosyalar", "file", "x.step", TestFiles.Text("x"), Kind("cizim"))).Code);
    }

    [Fact]
    public async Task Dosyanin_yeni_surumu_eskisini_gecmiste_tutar()
    {
        var owner = await TestClient.Register(api);
        var member = await TestClient.Register(api);
        var id = await NewProject(owner);
        await owner.Post($"/api/projects/{id}/ekip", new { username = member.Username });
        var v1 = await owner.Upload($"/api/projects/{id}/dosyalar", "file", "kapak.dxf", TestFiles.Text("v1"), Kind("cizim"));
        var fileId = v1["id"].GetValue<int>();
        var v1Url = v1["fileUrl"].GetValue<string>();

        var v2 = await member.Upload($"/api/projects/{id}/dosyalar/{fileId}/surum", "file", "kapak-v2.dxf", TestFiles.Text("v2"), new Dictionary<string, string> { ["note"] = "delikler büyütüldü" });
        Assert.True(v2.Ok, v2.ToString());
        Assert.Equal(fileId, v2["id"].GetValue<int>());                 // aynı kayıt: bağlantılar bozulmaz
        Assert.Equal(2, v2["version"].GetValue<int>());
        Assert.Equal("delikler büyütüldü", v2["versionNote"].GetValue<string>());
        Assert.Equal("v2", await (await member.Raw(v2["fileUrl"].GetValue<string>())).Content.ReadAsStringAsync());

        var history = (await TestClient.Guest(api).Get($"/api/projects/{id}/dosyalar/{fileId}/surumler")).Array;
        var old = Assert.Single(history)!;
        Assert.Equal(1, old["version"]!.GetValue<int>());
        Assert.Equal("kapak.dxf", old["fileName"]!.GetValue<string>());
        Assert.Equal(v1Url, old["fileUrl"]!.GetValue<string>());
        Assert.Equal("v1", await (await member.Raw(v1Url)).Content.ReadAsStringAsync()); // eski sürüm indirilebilir

        // Bölüme uymayan tür ve yabancı reddedilir
        Assert.Equal(400, (await owner.Upload($"/api/projects/{id}/dosyalar/{fileId}/surum", "file", "x.ino", TestFiles.Text("x"))).Code);
        var stranger = await TestClient.Register(api);
        Assert.Equal(403, (await stranger.Upload($"/api/projects/{id}/dosyalar/{fileId}/surum", "file", "x.dxf", TestFiles.Text("x"))).Code);

        // Dosya silinince eski sürümler de depodan gider
        Assert.True((await owner.Delete($"/api/projects/{id}/dosyalar/{fileId}")).Ok);
        Assert.Equal(404, (int)(await owner.Raw(v1Url)).StatusCode);
    }

    [Fact]
    public async Task Modelin_yeni_surumu_yorumlarini_korur_proje_silinince_hepsi_gider()
    {
        var owner = await TestClient.Register(api);
        var fan = await TestClient.Register(api);
        var id = await NewProject(owner);
        await owner.Upload("/api/printmodels", "file", "kol.stl", TestFiles.Stl, new Dictionary<string, string> { ["title"] = "Kol", ["projectId"] = id.ToString() });
        var model = (await owner.Get($"/api/printmodels?projectId={id}")).Array[0]!;
        var modelId = model["id"]!.GetValue<int>();
        var v1Url = model["fileUrl"]!.GetValue<string>();
        await fan.Post($"/api/yorum/model/{modelId}", new { content = "harika" });

        var v2 = await owner.Upload($"/api/printmodels/{modelId}/surum", "file", "kol2.stl", TestFiles.Stl, new Dictionary<string, string> { ["note"] = "daha ince" });
        Assert.True(v2.Ok, v2.ToString());
        Assert.Equal(2, v2["version"].GetValue<int>());
        Assert.Equal(400, (await owner.Upload($"/api/printmodels/{modelId}/surum", "file", "kol.step", TestFiles.Text("x"))).Code);

        var listed = (await owner.Get($"/api/printmodels?projectId={id}")).Array[0]!;
        Assert.Equal(2, listed["version"]!.GetValue<int>());
        Assert.Equal("daha ince", listed["versionNote"]!.GetValue<string>());
        Assert.Single((await owner.Get($"/api/yorum/model/{modelId}")).Array); // yorum yerinde
        var history = (await owner.Get($"/api/printmodels/{modelId}/surumler")).Array;
        Assert.Equal("Kol.stl", Assert.Single(history)!["fileName"]!.GetValue<string>());

        Assert.True((await owner.Delete($"/api/projects/{id}")).Ok);
        Assert.Equal(404, (int)(await owner.Raw(v1Url)).StatusCode);
        Assert.Equal(404, (int)(await owner.Raw(v2["fileUrl"].GetValue<string>())).StatusCode);
    }
}
