namespace Karalevha.API.Tests;

[Collection(ApiCollection.Name)]
public class ObaInviteTests(ApiFactory api)
{
    private static async Task<(int Id, string Name)> NewUnlisted(TestClient owner)
    {
        var name = "Gizli ekip " + Guid.NewGuid().ToString("N")[..6];
        var res = await owner.Post("/api/obalar", new { name, description = "x", color = "#d4ff3d", isUnlisted = true });
        Assert.True(res.Ok, res.ToString());
        Assert.True(res["isPrivate"].GetValue<bool>());
        Assert.True(res["isUnlisted"].GetValue<bool>());
        return (res["id"].GetValue<int>(), name);
    }

    private static bool Lists(Response list, int id) => list.Array.Any(o => o!["id"]!.GetValue<int>() == id);

    [Fact]
    public async Task Gorunmeyen_oba_listede_ve_aramada_cikmaz()
    {
        var owner = await TestClient.Register(api);
        var other = await TestClient.Register(api);
        var (id, name) = await NewUnlisted(owner);

        Assert.True(Lists(await owner.Get("/api/obalar"), id));
        Assert.False(Lists(await other.Get("/api/obalar"), id));
        Assert.False(Lists(await TestClient.Guest(api).Get("/api/obalar"), id));
        var search = await other.Get($"/api/search?q={Uri.EscapeDataString(name)}");
        Assert.DoesNotContain(search["obalar"].AsArray(), o => o!["id"]!.GetValue<int>() == id);
        Assert.Equal(404, (await other.Get($"/api/obachannels/{id}")).Code);
    }

    [Fact]
    public async Task Davetle_katilinir_sifreyle_katilinmaz()
    {
        var owner = await TestClient.Register(api);
        var guest = await TestClient.Register(api);
        var (id, name) = await NewUnlisted(owner);

        Assert.Equal(403, (await guest.Post($"/api/obalar/{id}/join", new { password = "x" })).Code);
        Assert.Equal(403, (await guest.Get($"/api/obalar/{id}/davet")).Code); // kodu yalnızca kurucu görür

        var code = (await owner.Get($"/api/obalar/{id}/davet"))["code"].GetValue<string>();
        Assert.True(code.Length >= 20);
        var preview = await TestClient.Guest(api).Get($"/api/obalar/davet/{code}");
        Assert.Equal(name, preview["name"].GetValue<string>());
        Assert.False(preview["isMember"].GetValue<bool>());

        var joined = await guest.Post($"/api/obalar/davet/{code}/katil");
        Assert.Equal(id, joined["id"].GetValue<int>());
        Assert.True(Lists(await guest.Get("/api/obalar"), id));
        Assert.True((await guest.Get($"/api/obachannels/{id}")).Ok);
    }

    [Fact]
    public async Task Davet_yenilenince_eski_baglanti_gecersiz()
    {
        var owner = await TestClient.Register(api);
        var (id, _) = await NewUnlisted(owner);
        var old = (await owner.Get($"/api/obalar/{id}/davet"))["code"].GetValue<string>();
        var fresh = (await owner.Post($"/api/obalar/{id}/davet/yenile"))["code"].GetValue<string>();
        Assert.NotEqual(old, fresh);
        Assert.Equal(404, (await TestClient.Guest(api).Get($"/api/obalar/davet/{old}")).Code);
        Assert.True((await TestClient.Guest(api).Get($"/api/obalar/davet/{fresh}")).Ok);
    }
}
