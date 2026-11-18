namespace Karalevha.API.Tests;

[Collection(ApiCollection.Name)]
public class ProjectTests(ApiFactory api)
{
    private static async Task<int> NewProject(TestClient owner, string category = "robotik", string repo = "")
    {
        var res = await owner.Post("/api/projects", new { title = "Test projesi", description = "Dört eksenli kol", repoUrl = repo, category });
        Assert.True(res.Ok, res.ToString());
        return res["id"].GetValue<int>();
    }

    [Fact]
    public async Task Depo_adresi_istege_bagli_dal_secilir()
    {
        var me = await TestClient.Register(api);
        var id = await NewProject(me, "elektronik");
        var p = await me.Get($"/api/projects/{id}");
        Assert.Equal("elektronik", p["category"].GetValue<string>());
        Assert.Equal("", p["repoUrl"].GetValue<string>());
        Assert.Equal(me.Id, p["userId"].GetValue<int>());
    }

    [Theory]
    [InlineData("uzay", "")]
    [InlineData("robotik", "ftp://depo.example/kol")]
    public async Task Gecersiz_dal_ya_da_depo_reddedilir(string category, string repo)
    {
        var me = await TestClient.Register(api);
        var res = await me.Post("/api/projects", new { title = "x", description = "y", repoUrl = repo, category });
        Assert.Equal(400, res.Code);
    }

    [Fact]
    public async Task Dosya_turleri_listesi()
    {
        var res = await TestClient.Guest(api).Get("/api/projects/dosya-turleri");
        Assert.Contains(".step", res["cizim"].AsArray().Select(x => x!.GetValue<string>()));
        Assert.Contains(".kicad_pcb", res["elektronik"].AsArray().Select(x => x!.GetValue<string>()));
        Assert.Contains(".ino", res["kod"].AsArray().Select(x => x!.GetValue<string>()));
    }

    [Theory]
    [InlineData("kart.kicad_pcb", "elektronik")]
    [InlineData("surucu.ino", "kod")]
    [InlineData("govde.step", "cizim")]
    [InlineData("robot.urdf", "cizim")]
    [InlineData("sema.pdf", "elektronik")] // görsel/PDF her bölüme eklenir
    public async Task Dosya_kendi_bolumune_eklenir(string fileName, string kind)
    {
        var me = await TestClient.Register(api);
        var id = await NewProject(me);
        var res = await me.Upload($"/api/projects/{id}/dosyalar", "file", fileName, TestFiles.Text("icerik"), new Dictionary<string, string> { ["kind"] = kind });
        Assert.True(res.Ok, res.ToString());
        Assert.Equal(kind, res["kind"].GetValue<string>());
    }

    [Theory]
    [InlineData("kod.ino", "elektronik")]
    [InlineData("virus.exe", "cizim")]
    [InlineData("sayfa.html", "kod")]
    public async Task Bolume_uymayan_dosya_reddedilir(string fileName, string kind)
    {
        var me = await TestClient.Register(api);
        var id = await NewProject(me);
        var res = await me.Upload($"/api/projects/{id}/dosyalar", "file", fileName, TestFiles.Text("x"), new Dictionary<string, string> { ["kind"] = kind });
        Assert.Equal(400, res.Code);
    }

    [Fact]
    public async Task Yalnizca_sahibi_dosya_ve_model_ekler()
    {
        var owner = await TestClient.Register(api);
        var other = await TestClient.Register(api);
        var id = await NewProject(owner);
        Assert.Equal(403, (await other.Upload($"/api/projects/{id}/dosyalar", "file", "a.step", TestFiles.Text("x"), new Dictionary<string, string> { ["kind"] = "cizim" })).Code);
        Assert.Equal(403, (await other.Upload("/api/printmodels", "file", "a.stl", TestFiles.Stl, new Dictionary<string, string> { ["title"] = "x", ["projectId"] = id.ToString() })).Code);
    }

    [Fact]
    public async Task Model_projesiz_yuklenemez()
    {
        var me = await TestClient.Register(api);
        var res = await me.Upload("/api/printmodels", "file", "a.stl", TestFiles.Stl, new Dictionary<string, string> { ["title"] = "x" });
        Assert.Equal(400, res.Code);
    }

    [Fact]
    public async Task Bolum_sayilari_ve_kapak_modeli()
    {
        var me = await TestClient.Register(api);
        var id = await NewProject(me);
        await me.Upload($"/api/projects/{id}/dosyalar", "file", "kart.kicad_pcb", TestFiles.Text("x"), new Dictionary<string, string> { ["kind"] = "elektronik" });
        await me.Upload($"/api/projects/{id}/dosyalar", "file", "sema.pdf", TestFiles.Text("%PDF"), new Dictionary<string, string> { ["kind"] = "elektronik" });
        await me.Upload($"/api/projects/{id}/dosyalar", "file", "ana.ino", TestFiles.Text("void setup(){}"), new Dictionary<string, string> { ["kind"] = "kod" });
        await me.Upload($"/api/projects/{id}/dosyalar", "file", "govde.step", TestFiles.Text("ISO-10303-21;"), new Dictionary<string, string> { ["kind"] = "cizim" });
        var model = await me.Upload("/api/printmodels", "file", "kol.stl", TestFiles.Stl, new Dictionary<string, string> { ["title"] = "Kol", ["projectId"] = id.ToString() });
        Assert.True(model.Ok, model.ToString());

        var p = await me.Get($"/api/projects/{id}");
        Assert.Equal(2, p["electronicsCount"].GetValue<int>());
        Assert.Equal(1, p["codeFileCount"].GetValue<int>());
        Assert.Equal(1, p["drawingCount"].GetValue<int>());
        Assert.Equal(1, p["modelCount"].GetValue<int>());
        Assert.Equal(model["id"].GetValue<int>(), p["cover"]["id"].GetValue<int>());

        // Eski /baski-istasyonu?model= bağlantıları için modelden projeye
        var lookup = await me.Get($"/api/printmodels/{model["id"]}");
        Assert.Equal(id, lookup["projectId"].GetValue<int>());
    }

    [Fact]
    public async Task Proje_silinince_dosyalari_ve_modelleri_depodan_gider()
    {
        var me = await TestClient.Register(api);
        var id = await NewProject(me);
        var file = await me.Upload($"/api/projects/{id}/dosyalar", "file", "ana.ino", TestFiles.Text("x"), new Dictionary<string, string> { ["kind"] = "kod" });
        await me.Upload("/api/printmodels", "file", "kol.stl", TestFiles.Stl, new Dictionary<string, string> { ["title"] = "Kol", ["projectId"] = id.ToString() });
        var modelUrl = (await me.Get($"/api/printmodels?projectId={id}")).Array[0]!["fileUrl"]!.GetValue<string>();
        var fileUrl = file["fileUrl"].GetValue<string>();
        Assert.Equal(200, (int)(await me.Raw(fileUrl)).StatusCode);

        Assert.True((await me.Delete($"/api/projects/{id}")).Ok);
        Assert.Equal(404, (int)(await me.Raw(fileUrl)).StatusCode);
        Assert.Equal(404, (int)(await me.Raw(modelUrl)).StatusCode);
        Assert.False(File.Exists(api.StoragePath(fileUrl.TrimStart('/'))));
    }

    [Fact]
    public async Task Baskasinin_projesi_silinemez_yonetici_siler()
    {
        var owner = await TestClient.Register(api);
        var other = await TestClient.Register(api);
        var admin = await TestClient.Admin(api);
        var id = await NewProject(owner);
        Assert.Equal(403, (await other.Delete($"/api/projects/{id}")).Code);
        Assert.True((await admin.Delete($"/api/projects/{id}")).Ok);
    }
}
