using Karalevha.API.Services;

namespace Karalevha.API.Tests;

[Collection(ApiCollection.Name)]
public class StorageTests(ApiFactory api)
{
    [Fact]
    public async Task Yuklenen_dosya_guvenli_basliklarla_sunulur()
    {
        var me = await TestClient.Register(api);
        var id = (await me.Post("/api/projects", new { title = "Depo", description = "x", category = "yazilim" }))["id"].GetValue<int>();
        var url = (await me.Upload($"/api/projects/{id}/dosyalar", "file", "ana.ino", TestFiles.Text("void setup() {}\n"), new Dictionary<string, string> { ["kind"] = "kod" }))["fileUrl"].GetValue<string>();

        var res = await TestClient.Guest(api).Raw(url);
        Assert.Equal(200, (int)res.StatusCode);
        Assert.Equal("void setup() {}\n", await res.Content.ReadAsStringAsync());
        Assert.StartsWith("text/plain", res.Content.Headers.ContentType?.ToString());
        Assert.Contains("sandbox", res.Headers.GetValues("Content-Security-Policy").Single());
        Assert.Equal("nosniff", res.Headers.GetValues("X-Content-Type-Options").Single());
        Assert.Contains("immutable", res.Headers.CacheControl?.ToString());

        var part = await TestClient.Guest(api).Raw(url, r => r.Headers.Range = new System.Net.Http.Headers.RangeHeaderValue(0, 3));
        Assert.Equal(206, (int)part.StatusCode);
        Assert.Equal("void", await part.Content.ReadAsStringAsync());
    }

    [Theory]
    [InlineData("/uploads/yok/olmayan.stl")]
    [InlineData("/uploads/..%2F..%2Fappsettings.json")]
    [InlineData("/uploads/models/..%2F..%2F..%2FProgram.cs")]
    public async Task Olmayan_ya_da_kacak_yol_404(string path)
    {
        var res = await TestClient.Guest(api).Raw(path);
        Assert.Equal(404, (int)res.StatusCode);
    }

    [Theory]
    [InlineData("uploads/models/a.stl", true)]
    [InlineData("oba-files/abc.pdf", true)]
    [InlineData("market/x.dxf", true)]
    [InlineData("uploads/../market/x.dxf", false)]
    [InlineData("baska/x.txt", false)]
    [InlineData("uploads/models/a b.stl", false)]
    [InlineData("/uploads/models/a.stl", false)]
    public void Dosya_anahtari_denetimi(string key, bool valid) => Assert.Equal(valid, FileKeys.IsValid(key));

    [Fact]
    public async Task Baski_fotografi_yuklenir_ve_silinince_gider()
    {
        var owner = await TestClient.Register(api);
        var maker = await TestClient.Register(api);
        var id = (await owner.Post("/api/projects", new { title = "Baskı", description = "x", category = "tasarim" }))["id"].GetValue<int>();
        await owner.Upload("/api/printmodels", "file", "kol.stl", TestFiles.Stl, new Dictionary<string, string> { ["title"] = "Kol", ["projectId"] = id.ToString() });
        var modelId = (await owner.Get($"/api/printmodels?projectId={id}")).Array[0]!["id"]!.GetValue<int>();

        var make = await maker.Upload($"/api/bastim/model/{modelId}", "photo", "p.png", TestFiles.Png, new Dictionary<string, string> { ["note"] = "güzel oldu" });
        Assert.True(make.Ok, make.ToString());
        var photo = make["photoPath"].GetValue<string>();
        var res = await TestClient.Guest(api).Raw(photo);
        Assert.Equal("image/png", res.Content.Headers.ContentType?.MediaType);

        Assert.True((await maker.Delete($"/api/bastim/{make["id"]}")).Ok);
        Assert.Equal(404, (int)(await TestClient.Guest(api).Raw(photo)).StatusCode);
    }

    [Fact]
    public async Task Resim_olmayan_baski_fotografi_reddedilir()
    {
        var owner = await TestClient.Register(api);
        var id = (await owner.Post("/api/projects", new { title = "Baskı", description = "x", category = "tasarim" }))["id"].GetValue<int>();
        await owner.Upload("/api/printmodels", "file", "kol.stl", TestFiles.Stl, new Dictionary<string, string> { ["title"] = "Kol", ["projectId"] = id.ToString() });
        var modelId = (await owner.Get($"/api/printmodels?projectId={id}")).Array[0]!["id"]!.GetValue<int>();
        var res = await owner.Upload($"/api/bastim/model/{modelId}", "photo", "p.png", TestFiles.Text("<svg onload=alert(1)>"));
        Assert.Equal(400, res.Code);
    }
}
