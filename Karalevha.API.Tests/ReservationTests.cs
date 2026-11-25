using Karalevha.API.Models;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace Karalevha.API.Tests;

/// <summary>
/// Rezervasyon çakışması, gerçek PostgreSQL ile: uygulamadaki ön kontrol kullanıcıya kimin hangi saati
/// tuttuğunu söyler; asıl garanti veritabanındaki EX_Reservations_NoOverlap kuralıdır.
/// </summary>
[Collection(ApiCollection.Name)]
public class ReservationTests(ApiFactory api)
{
    /// <summary>Testler birbirinin saatlerine basmasın diye her test kendi ekipmanını kullanır</summary>
    private async Task<int> NewEquipment(string status = "hazir")
    {
        var admin = await TestClient.Admin(api);
        var res = await admin.Post("/api/atolye/ekipman", new { name = "Yazıcı " + Guid.NewGuid().ToString("N")[..5], kind = "yazici", status });
        Assert.True(res.Ok, res.ToString());
        return res["id"].GetValue<int>();
    }

    /// <summary>Yarın, tam saatte başlayan bir zaman (UTC)</summary>
    private static DateTime At(int hour, int minute = 0)
    {
        var d = DateTime.UtcNow.Date.AddDays(2);
        return d.AddHours(hour).AddMinutes(minute);
    }

    private static Task<Response> Reserve(TestClient who, int equipmentId, DateTime start, DateTime end) =>
        who.Post("/api/atolye/rezervasyon", new { equipmentId, startsAt = start, endsAt = end });

    [Fact]
    public async Task Tam_ve_kismi_cakisma_409()
    {
        var eq = await NewEquipment();
        var a = await TestClient.Register(api);
        var b = await TestClient.Register(api);
        Assert.True((await Reserve(a, eq, At(10), At(12))).Ok);

        var same = await Reserve(b, eq, At(10), At(12));
        Assert.Equal(409, same.Code);
        Assert.Contains(a.Username, same.ToString());                  // kimin tuttuğu söylenir
        Assert.Equal(409, (await Reserve(b, eq, At(11), At(13))).Code); // sondan kesişiyor
        Assert.Equal(409, (await Reserve(b, eq, At(9), At(10, 30))).Code); // baştan kesişiyor
        Assert.Equal(409, (await Reserve(b, eq, At(10, 30), At(11))).Code); // içinde
        Assert.Equal(409, (await Reserve(b, eq, At(9), At(13))).Code);   // kapsıyor
    }

    [Fact]
    public async Task Ardisik_aralik_kabul_edilir()
    {
        var eq = await NewEquipment();
        var a = await TestClient.Register(api);
        var b = await TestClient.Register(api);
        Assert.True((await Reserve(a, eq, At(10), At(11))).Ok);
        Assert.True((await Reserve(b, eq, At(11), At(12))).Ok); // bitiş = başlangıç
        Assert.True((await Reserve(b, eq, At(9), At(10))).Ok);
    }

    [Fact]
    public async Task Farkli_ekipman_ayni_saatte_kabul_edilir()
    {
        var eq1 = await NewEquipment();
        var eq2 = await NewEquipment();
        var a = await TestClient.Register(api);
        Assert.True((await Reserve(a, eq1, At(14), At(16))).Ok);
        Assert.True((await Reserve(a, eq2, At(14), At(16))).Ok);
    }

    [Fact]
    public async Task Iptal_edilen_rezervasyon_engel_olmaz()
    {
        var eq = await NewEquipment();
        var a = await TestClient.Register(api);
        var b = await TestClient.Register(api);
        var first = await Reserve(a, eq, At(10), At(12));
        Assert.True(first.Ok);
        Assert.True((await a.Delete($"/api/atolye/rezervasyon/{first["id"]}")).Ok);
        Assert.True((await Reserve(b, eq, At(10), At(12))).Ok);
    }

    [Fact]
    public async Task Mevcut_kurallar_korunur()
    {
        var a = await TestClient.Register(api);
        var eq = await NewEquipment();
        Assert.Equal(400, (await Reserve(a, eq, At(12), At(11))).Code);                           // ters
        Assert.Equal(400, (await Reserve(a, eq, At(10), At(10))).Code);                           // boş
        Assert.Equal(400, (await Reserve(a, eq, At(0), At(13))).Code);                            // 12 saatten uzun
        Assert.Equal(400, (await Reserve(a, eq, DateTime.UtcNow.AddHours(-2), DateTime.UtcNow.AddHours(-1))).Code); // geçmiş
        Assert.Equal(400, (await Reserve(a, eq, DateTime.UtcNow.AddDays(40), DateTime.UtcNow.AddDays(40).AddHours(1))).Code); // 30 günden ileri
        var broken = await NewEquipment("bakimda");
        Assert.Equal(400, (await Reserve(a, broken, At(10), At(11))).Code);                       // bakımda
    }

    [Fact]
    public async Task Ayni_anda_gelen_isteklerden_yalnizca_biri_kaydedilir()
    {
        for (var round = 0; round < 3; round++)
        {
            var eq = await NewEquipment();
            var people = new List<TestClient>();
            for (var i = 0; i < 6; i++) people.Add(await TestClient.Register(api));

            // Hepsi aynı anda, birbiriyle kesişen saatleri ister
            using var gate = new SemaphoreSlim(0);
            var tasks = people.Select(async (p, i) =>
            {
                await gate.WaitAsync();
                return await Reserve(p, eq, At(10, i * 5), At(11, i * 5));
            }).ToList();
            gate.Release(people.Count);
            var results = await Task.WhenAll(tasks);

            Assert.Equal(1, results.Count(r => r.Ok));
            Assert.All(results.Where(r => !r.Ok), r => Assert.Equal(409, r.Code)); // 500 değil, kontrollü 409

            await using var db = api.NewDb();
            Assert.Equal(1, await db.Reservations.CountAsync(r => r.EquipmentId == eq));
        }
    }

    [Fact]
    public async Task Veritabani_kurali_uygulamayi_atlayan_kaydi_da_reddeder()
    {
        var eq = await NewEquipment();
        var a = await TestClient.Register(api);
        Assert.True((await Reserve(a, eq, At(10), At(12))).Ok);

        // Uygulamadaki ön kontrol hiç çalışmadan doğrudan veritabanına yazılırsa
        await using var db = api.NewDb();
        db.Reservations.Add(new Reservation { EquipmentId = eq, UserId = a.Id, StartsAt = At(11), EndsAt = At(13) });
        var ex = await Assert.ThrowsAsync<DbUpdateException>(() => db.SaveChangesAsync());
        Assert.Equal(PostgresErrorCodes.ExclusionViolation, (ex.InnerException as PostgresException)?.SqlState);

        await using var db2 = api.NewDb();
        db2.Reservations.Add(new Reservation { EquipmentId = eq, UserId = a.Id, StartsAt = At(15), EndsAt = At(14) });
        var ex2 = await Assert.ThrowsAsync<DbUpdateException>(() => db2.SaveChangesAsync());
        Assert.Equal(PostgresErrorCodes.CheckViolation, (ex2.InnerException as PostgresException)?.SqlState);
    }
}
