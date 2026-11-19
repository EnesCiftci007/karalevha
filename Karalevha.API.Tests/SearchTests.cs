namespace Karalevha.API.Tests;

/// <summary>Arama projeleri içeriğiyle de bulur ve neden bulduğunu söyler</summary>
[Collection(ApiCollection.Name)]
public class SearchTests(ApiFactory api)
{
    private static System.Text.Json.Nodes.JsonNode? Hit(Response res, int projectId) =>
        res["projects"].AsArray().FirstOrDefault(p => p!["id"]!.GetValue<int>() == projectId);

    [Fact]
    public async Task Dosya_model_ekip_ve_dal_ile_bulunur()
    {
        var tag = Guid.NewGuid().ToString("N")[..6];
        var owner = await TestClient.Register(api);
        var member = await TestClient.Register(api, $"t_uye{tag}");
        var id = (await owner.Post("/api/projects", new { title = "Ara " + tag, description = "x", category = "elektronik" }))["id"].GetValue<int>();
        await owner.Post($"/api/projects/{id}/ekip", new { username = member.Username });
        await owner.Upload($"/api/projects/{id}/dosyalar", "file", $"surucu{tag}.kicad_sch", TestFiles.Text("(kicad_sch)"), new Dictionary<string, string> { ["kind"] = "elektronik" });
        await owner.Upload("/api/printmodels", "file", "a.stl", TestFiles.Stl, new Dictionary<string, string> { ["title"] = $"Gövde{tag}", ["projectId"] = id.ToString() });

        var byFile = Hit(await owner.Get($"/api/search?q=surucu{tag}"), id);
        Assert.Equal($"dosya: surucu{tag}.kicad_sch", byFile!["match"]!.GetValue<string>());

        var byModel = Hit(await owner.Get($"/api/search?q={Uri.EscapeDataString("Gövde" + tag)}"), id);
        Assert.Equal($"model: Gövde{tag}", byModel!["match"]!.GetValue<string>());

        var byMember = Hit(await owner.Get($"/api/search?q=t_uye{tag}"), id);
        Assert.Equal($"ekip: t_uye{tag}", byMember!["match"]!.GetValue<string>());

        // Adı eşleşince neden yazılmaz
        Assert.Null(Hit(await owner.Get($"/api/search?q=Ara%20{tag}"), id)!["match"]);

        // Dal: Türkçe ve ASCII yazımla; iki harf dalı getirmez
        var elektronik = await owner.Get("/api/search?q=elektronik");
        Assert.Contains(elektronik["projects"].AsArray(), p => p!["match"]?.GetValue<string>() == "dal: Elektronik");
    }

    [Fact]
    public async Task Dal_aramasi_turkce_ve_ascii_kisa_terim_getirmez()
    {
        var owner = await TestClient.Register(api);
        var id = (await owner.Post("/api/projects", new { title = "Dal testi", description = "x", category = "yazilim" }))["id"].GetValue<int>();

        Assert.Equal("dal: Yazılım", Hit(await owner.Get("/api/search?q=yaz%C4%B1l%C4%B1m"), id)?["match"]?.GetValue<string>());
        Assert.NotNull(Hit(await owner.Get("/api/search?q=yazilim"), id));
        Assert.Null(Hit(await owner.Get("/api/search?q=ya"), id));
    }

    [Fact]
    public async Task Kisa_terim_bos_doner()
    {
        var res = await TestClient.Guest(api).Get("/api/search?q=a");
        Assert.Empty(res["projects"].AsArray());
    }
}
