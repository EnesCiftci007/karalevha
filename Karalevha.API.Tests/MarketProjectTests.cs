namespace Karalevha.API.Tests;

/// <summary>Projedeki model ya da dosyadan, yeniden yüklemeden Market siparişi</summary>
[Collection(ApiCollection.Name)]
public class MarketProjectTests(ApiFactory api)
{
    private static async Task<(int ProjectId, int ModelId, int DxfId)> ProjectWithParts(TestClient owner)
    {
        var projectId = (await owner.Post("/api/projects", new { title = "Robot kol", description = "x", category = "robotik" }))["id"].GetValue<int>();
        await owner.Upload("/api/printmodels", "file", "kol.stl", TestFiles.Stl, new Dictionary<string, string> { ["title"] = "Kol", ["projectId"] = projectId.ToString() });
        var modelId = (await owner.Get($"/api/printmodels?projectId={projectId}")).Array[0]!["id"]!.GetValue<int>();
        var dxf = await owner.Upload($"/api/projects/{projectId}/dosyalar", "file", "govde.dxf", TestFiles.Text("0\nSECTION\n"), new Dictionary<string, string> { ["kind"] = "cizim" });
        return (projectId, modelId, dxf["id"].GetValue<int>());
    }

    private static Task<Response> OrderFrom(TestClient who, string service, string material, string type, int id) =>
        who.Upload("/api/market/siparis", "unused", "unused.txt", Array.Empty<byte>(), new Dictionary<string, string>
        {
            ["service"] = service, ["material"] = material, ["quantity"] = "1", ["sourceType"] = type, ["sourceId"] = id.ToString(),
        });

    [Fact]
    public async Task Kaynak_bilgisi_uygun_hizmetleri_soyler()
    {
        var owner = await TestClient.Register(api);
        var (_, modelId, dxfId) = await ProjectWithParts(owner);

        var model = await owner.Get($"/api/market/kaynak?tur=model&id={modelId}");
        Assert.Equal("Kol.stl", model["fileName"].GetValue<string>());
        Assert.Equal("Robot kol", model["projectTitle"].GetValue<string>());
        var modelServices = model["services"].AsArray().Select(x => x!.GetValue<string>()).ToList();
        Assert.Contains("baski", modelServices);
        Assert.Contains("cnc", modelServices);
        Assert.DoesNotContain("pcb", modelServices);

        var dxf = await owner.Get($"/api/market/kaynak?tur=dosya&id={dxfId}");
        Assert.Contains("lazer", dxf["services"].AsArray().Select(x => x!.GetValue<string>()));
        Assert.Equal(404, (await owner.Get("/api/market/kaynak?tur=dosya&id=9999999")).Code);
    }

    [Fact]
    public async Task Projedeki_modelden_siparis_dosyasi_kopyalanir()
    {
        var owner = await TestClient.Register(api);
        var maker = await TestClient.Register(api); // başkasının projesindeki modeli de bastırabilir
        var (projectId, modelId, _) = await ProjectWithParts(owner);

        var order = await OrderFrom(maker, "baski", "PLA", "model", modelId);
        Assert.True(order.Ok, order.ToString());
        Assert.Equal(projectId, order["projectId"].GetValue<int>());
        Assert.Equal("Robot kol · Kol.stl", order["sourceLabel"].GetValue<string>());
        Assert.Equal("Kol.stl", order["fileName"].GetValue<string>());
        Assert.Equal(TestFiles.Stl.Length, order["fileSize"].GetValue<long>());

        var file = await maker.Raw($"/api/market/siparis/{order["id"]}/dosya");
        Assert.Equal(TestFiles.Stl, await file.Content.ReadAsByteArrayAsync());
    }

    [Fact]
    public async Task Hizmete_uymayan_ya_da_olmayan_kaynak_reddedilir()
    {
        var owner = await TestClient.Register(api);
        var (_, modelId, dxfId) = await ProjectWithParts(owner);
        Assert.Equal(400, (await OrderFrom(owner, "pcb", "FR4 tek katlı", "model", modelId)).Code); // STL ile kart olmaz
        Assert.Equal(400, (await OrderFrom(owner, "baski", "PLA", "dosya", dxfId)).Code);           // DXF basılmaz
        Assert.Equal(404, (await OrderFrom(owner, "lazer", "Akrilik 3 mm", "dosya", 9999999)).Code);
        Assert.Equal(404, (await OrderFrom(owner, "lazer", "Akrilik 3 mm", "uzay", dxfId)).Code);
    }

    [Fact]
    public async Task Proje_silinse_de_siparis_ve_dosyasi_kalir()
    {
        var owner = await TestClient.Register(api);
        var (projectId, _, dxfId) = await ProjectWithParts(owner);
        var order = await OrderFrom(owner, "lazer", "Akrilik 3 mm", "dosya", dxfId);
        Assert.True(order.Ok, order.ToString());

        Assert.True((await owner.Delete($"/api/projects/{projectId}")).Ok);
        var mine = (await owner.Get("/api/market/siparislerim")).Array.Single(o => o!["id"]!.GetValue<int>() == order["id"].GetValue<int>())!;
        Assert.Null(mine["projectId"]);
        Assert.Equal("Robot kol · govde.dxf", mine["sourceLabel"]!.GetValue<string>());
        var file = await owner.Raw($"/api/market/siparis/{order["id"]}/dosya");
        Assert.Equal("0\nSECTION\n", await file.Content.ReadAsStringAsync());
    }
}
