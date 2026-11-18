namespace Karalevha.API.Tests;

[Collection(ApiCollection.Name)]
public class MarketTests(ApiFactory api)
{
    private static Task<Response> Order(TestClient who, string service = "lazer", string material = "Akrilik 3 mm", string file = "parca.dxf") =>
        who.Upload("/api/market/siparis", "file", file, TestFiles.Text("0\nSECTION\n"), new Dictionary<string, string>
        {
            ["service"] = service, ["material"] = material, ["quantity"] = "2", ["dimensions"] = "100 x 50 mm", ["note"] = "Kenarlar düzgün",
        });

    [Fact]
    public async Task Hizmet_katalogu()
    {
        var res = await TestClient.Guest(api).Get("/api/market/hizmetler");
        Assert.Equal(new[] { "cnc", "lazer", "baski", "pcb" }, res.Array.Select(x => x!["id"]!.GetValue<string>()));
    }

    [Theory]
    [InlineData("lazer", "PLA", "parca.dxf")]     // hizmete uymayan malzeme
    [InlineData("baski", "PLA", "parca.dxf")]     // hizmete uymayan dosya
    [InlineData("uzay", "PLA", "parca.stl")]      // olmayan hizmet
    public async Task Gecersiz_siparis_reddedilir(string service, string material, string file)
    {
        var me = await TestClient.Register(api);
        Assert.Equal(400, (await Order(me, service, material, file)).Code);
    }

    [Fact]
    public async Task Siparis_akisi_fiyat_onay_uretim()
    {
        var customer = await TestClient.Register(api);
        var admin = await TestClient.Admin(api);
        var order = await Order(customer);
        Assert.True(order.Ok, order.ToString());
        var id = order["id"].GetValue<int>();
        Assert.Equal("alindi", order["status"].GetValue<string>());

        // Üye fiyat veremez; yönetici fiyatsız "fiyatlandı" diyemez
        Assert.Equal(403, (await customer.Put($"/api/market/siparis/{id}", new { status = "fiyatlandi", price = 150.5 })).Code);
        Assert.Equal(400, (await admin.Put($"/api/market/siparis/{id}", new { status = "fiyatlandi" })).Code);

        var priced = await admin.Put($"/api/market/siparis/{id}", new { status = "fiyatlandi", price = 150.5, staffNote = "Cuma hazır" });
        Assert.Equal(150.5, priced["price"].GetValue<double>());
        var notes = await customer.Get("/api/notifications");
        Assert.Contains(notes.Array, n => n!["text"]!.GetValue<string>().Contains("fiyat"));

        var approved = await customer.Post($"/api/market/siparis/{id}/onay");
        Assert.Equal("onaylandi", approved["status"].GetValue<string>());

        await admin.Put($"/api/market/siparis/{id}", new { status = "uretimde", price = 150.5 });
        Assert.Equal(400, (await customer.Post($"/api/market/siparis/{id}/iptal")).Code); // üretimdeki iptal edilemez
    }

    [Fact]
    public async Task Siparis_dosyasi_gizli()
    {
        var customer = await TestClient.Register(api);
        var stranger = await TestClient.Register(api);
        var admin = await TestClient.Admin(api);
        var id = (await Order(customer))["id"].GetValue<int>();

        var own = await customer.Raw($"/api/market/siparis/{id}/dosya");
        Assert.Equal(200, (int)own.StatusCode);
        Assert.Equal("0\nSECTION\n", await own.Content.ReadAsStringAsync());
        Assert.Contains("parca.dxf", own.Content.Headers.ContentDisposition?.ToString());
        Assert.Equal(200, (int)(await admin.Raw($"/api/market/siparis/{id}/dosya")).StatusCode);
        Assert.Equal(403, (int)(await stranger.Raw($"/api/market/siparis/{id}/dosya")).StatusCode);
        Assert.Equal(401, (int)(await TestClient.Guest(api).Raw($"/api/market/siparis/{id}/dosya")).StatusCode);
        // Herkese açık /uploads'tan da ulaşılamaz
        Assert.Equal(404, (int)(await TestClient.Guest(api).Raw("/uploads/../market/x.dxf")).StatusCode);
    }

    [Fact]
    public async Task Siparislerim_yalnizca_kendi_siparislerim()
    {
        var a = await TestClient.Register(api);
        var b = await TestClient.Register(api);
        await Order(a);
        var mine = await b.Get("/api/market/siparislerim");
        Assert.Empty(mine.Array);
        Assert.Single((await a.Get("/api/market/siparislerim")).Array);
    }
}
