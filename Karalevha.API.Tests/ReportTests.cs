using Karalevha.API.Models;
using Microsoft.EntityFrameworkCore;

namespace Karalevha.API.Tests;

[Collection(ApiCollection.Name)]
public class ReportTests(ApiFactory api)
{
    private static async Task<int> Project(TestClient owner, string title = "Şikâyet testi")
    {
        var res = await owner.Post("/api/projects", new { title, description = "x", category = "diger" });
        return res["id"].GetValue<int>();
    }

    private static Task<Response> Report(TestClient who, string type, int id, string reason = "spam", string? note = null) =>
        who.Post("/api/sikayetler", new { targetType = type, targetId = id, reason, note });

    private static System.Text.Json.Nodes.JsonNode? Group(Response list, string type, int id) =>
        list.Array.FirstOrDefault(g => g!["targetType"]!.GetValue<string>() == type && g["targetId"]!.GetValue<int>() == id);

    [Fact]
    public async Task Uye_baskasinin_icerigini_bildirir_yonetici_gorur()
    {
        var owner = await TestClient.Register(api);
        var a = await TestClient.Register(api);
        var b = await TestClient.Register(api);
        var admin = await TestClient.Admin(api);
        var id = await Project(owner, "Spam proje");

        Assert.True((await Report(a, "project", id, "spam", "reklam linki var")).Ok);
        Assert.True((await Report(a, "project", id)).Ok); // ikinci kez: aynı yanıt, yeni kayıt yok
        Assert.True((await Report(b, "project", id, "uygunsuz")).Ok);

        var g = Group(await admin.Get("/api/sikayetler"), "project", id);
        Assert.NotNull(g);
        Assert.Equal(2, g!["count"]!.GetValue<int>());
        Assert.Equal("Spam proje", g["summary"]!.GetValue<string>());
        Assert.Equal(owner.Username, g["author"]!.GetValue<string>());
        Assert.Equal($"/projeler/{id}", g["link"]!.GetValue<string>());
        Assert.Contains(g["reports"]!.AsArray(), r => r!["note"]?.GetValue<string>() == "reklam linki var");

        // Yöneticiye yalnızca ilk şikâyette haber
        var notes = (await admin.Get("/api/notifications")).Array
            .Count(n => n!["text"]!.GetValue<string>().Contains("Spam proje"));
        Assert.Equal(1, notes);
        Assert.True((await admin.Get("/api/sikayetler/sayi"))["count"].GetValue<int>() >= 1);
    }

    [Fact]
    public async Task Kendi_icerigi_olmayan_ve_gecersiz_bildirimler_reddedilir()
    {
        var me = await TestClient.Register(api);
        var id = await Project(me);
        Assert.Equal(400, (await Report(me, "project", id)).Code);           // kendi içeriği
        Assert.Equal(400, (await Report(me, "uzay", id)).Code);              // türü yok
        Assert.Equal(400, (await Report(me, "project", id, "canimistedi")).Code);
        Assert.Equal(404, (await Report(me, "project", 9_999_999)).Code);    // içerik yok
        Assert.Equal(401, (await Report(TestClient.Guest(api), "project", id)).Code);
    }

    [Fact]
    public async Task Uye_sikayetleri_goremez_karar_veremez()
    {
        var member = await TestClient.Register(api);
        Assert.Equal(403, (await member.Get("/api/sikayetler")).Code);
        Assert.Equal(0, (await member.Get("/api/sikayetler/sayi"))["count"].GetValue<int>());
        Assert.Equal(403, (await member.Post("/api/sikayetler/karar", new { targetType = "project", targetId = 1, status = "reddedildi" })).Code);
    }

    [Fact]
    public async Task Kaldirildi_icin_icerik_gercekten_kalkmali_bildirene_haber_gider()
    {
        var owner = await TestClient.Register(api);
        var reporter = await TestClient.Register(api);
        var admin = await TestClient.Admin(api);
        var id = await Project(owner);
        await Report(reporter, "project", id, "telif");

        var early = await admin.Post("/api/sikayetler/karar", new { targetType = "project", targetId = id, status = "kaldirildi" });
        Assert.Equal(400, early.Code);

        Assert.True((await admin.Delete($"/api/projects/{id}")).Ok);
        var decided = await admin.Post("/api/sikayetler/karar", new { targetType = "project", targetId = id, status = "kaldirildi", note = "telif" });
        Assert.True(decided.Ok, decided.ToString());

        Assert.Null(Group(await admin.Get("/api/sikayetler"), "project", id));
        var closed = Group(await admin.Get("/api/sikayetler?durum=kapali"), "project", id);
        Assert.Equal("kaldirildi", closed!["status"]!.GetValue<string>());
        Assert.False(closed["exists"]!.GetValue<bool>());

        var notes = await reporter.Get("/api/notifications");
        Assert.Contains(notes.Array, n => n!["text"]!.GetValue<string>().Contains("kaldırıldı"));
        // Bildirilen kişi kimin bildirdiğini bilmez: sahibine şikâyet bildirimi gitmez
        Assert.DoesNotContain((await owner.Get("/api/notifications")).Array, n => n!["text"]!.GetValue<string>().Contains("şikâyet"));
    }

    [Fact]
    public async Task Yok_sayilinca_icerik_kalir_bildirene_haber_gider()
    {
        var owner = await TestClient.Register(api);
        var reporter = await TestClient.Register(api);
        var admin = await TestClient.Admin(api);
        var id = await Project(owner);
        await Report(reporter, "project", id, "diger");

        Assert.True((await admin.Post("/api/sikayetler/karar", new { targetType = "project", targetId = id, status = "reddedildi" })).Ok);
        Assert.True((await owner.Get($"/api/projects/{id}")).Ok);
        Assert.Contains((await reporter.Get("/api/notifications")).Array, n => n!["text"]!.GetValue<string>().Contains("aykırı bulunmadı"));
        // Kapandıktan sonra yeniden bildirilebilir
        Assert.True((await Report(reporter, "project", id, "spam")).Ok);
        Assert.NotNull(Group(await admin.Get("/api/sikayetler"), "project", id));
    }

    [Fact]
    public async Task Kullanici_sikayeti_askiya_almadan_kaldirildi_olmaz()
    {
        var target = await TestClient.Register(api);
        var reporter = await TestClient.Register(api);
        var admin = await TestClient.Admin(api);
        await Report(reporter, "user", target.Id, "taciz");

        Assert.Equal(400, (await admin.Post("/api/sikayetler/karar", new { targetType = "user", targetId = target.Id, status = "kaldirildi" })).Code);
        Assert.True((await admin.Post("/api/admin/ban-user", new { userId = target.Id, durationHours = 24 })).Ok);
        Assert.True((await admin.Post("/api/sikayetler/karar", new { targetType = "user", targetId = target.Id, status = "kaldirildi" })).Ok);
    }

    [Fact]
    public async Task Yorum_ve_oba_mesaji_bildirilir_baglantisi_dogru()
    {
        var owner = await TestClient.Register(api);
        var reporter = await TestClient.Register(api);
        var admin = await TestClient.Admin(api);
        var projectId = await Project(owner);

        var comment = await owner.Post($"/api/yorum/project/{projectId}", new { content = "kötü yorum" });
        Assert.True(comment.Ok, comment.ToString());
        var commentId = comment["id"].GetValue<int>();
        Assert.True((await Report(reporter, "comment", commentId, "taciz")).Ok);

        var oba = await owner.Post("/api/obalar", new { name = "Şikâyet obası " + Guid.NewGuid().ToString("N")[..5], description = "x", color = "#d4ff3d" });
        int channelId;
        using (var db = api.NewDb())
            channelId = await db.ObaChannels.Where(c => c.ObaId == oba["id"].GetValue<int>()).Select(c => c.Id).FirstAsync();
        var msg = await owner.Post($"/api/obamessages/{channelId}", new { content = "spam mesaj" });
        Assert.True(msg.Ok, msg.ToString());
        Assert.True((await Report(reporter, "obamessage", msg["id"].GetValue<int>(), "spam")).Ok);

        var list = await admin.Get("/api/sikayetler");
        Assert.Equal($"/projeler/{projectId}", Group(list, "comment", commentId)!["link"]!.GetValue<string>());
        var m = Group(list, "obamessage", msg["id"].GetValue<int>())!;
        Assert.Equal("spam mesaj", m["summary"]!.GetValue<string>());
        Assert.StartsWith($"/e-oba/{oba["id"]}?kanal={channelId}", m["link"]!.GetValue<string>());

        // Yönetici yorumu siler, şikâyet kapanır
        Assert.True((await admin.Delete($"/api/yorum/{commentId}")).Ok);
        Assert.True((await admin.Post("/api/sikayetler/karar", new { targetType = "comment", targetId = commentId, status = "kaldirildi" })).Ok);
        using var check = api.NewDb();
        Assert.True(await check.Reports.Where(r => r.TargetType == "comment" && r.TargetId == commentId).AllAsync(r => r.Status == ReportStatus.Removed));
    }
}
