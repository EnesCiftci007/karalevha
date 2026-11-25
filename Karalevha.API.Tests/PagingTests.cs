using System.Text.Json.Nodes;
using Microsoft.EntityFrameworkCore;

namespace Karalevha.API.Tests;

/// <summary>Cursor sayfalama: sınırlar, aynı zamanlı kayıtlar, tekrarsızlık, süzgeçler, mesajlar, eski biçim</summary>
[Collection(ApiCollection.Name)]
public class PagingTests(ApiFactory api)
{
    private static string NewTag() => "sayfa" + Guid.NewGuid().ToString("N")[..8];

    private static async Task<int> PostWith(TestClient who, string text)
    {
        var res = await who.Post("/api/posts", new { content = text });
        Assert.True(res.Ok, res.ToString());
        return res["id"].GetValue<int>();
    }

    /// <summary>Bütün sayfaları gezer; her sayfa en fazla limit kayıt</summary>
    private static async Task<List<int>> AllPages(TestClient who, string url, int limit)
    {
        var ids = new List<int>();
        string? cursor = null;
        for (var guard = 0; guard < 100; guard++)
        {
            var sep = url.Contains('?') ? "&" : "?";
            var res = await who.Get($"{url}{sep}limit={limit}" + (cursor == null ? "" : "&cursor=" + Uri.EscapeDataString(cursor)));
            Assert.True(res.Ok, res.ToString());
            var items = res["items"].AsArray();
            Assert.True(items.Count <= limit);
            ids.AddRange(items.Select(i => i!["id"]!.GetValue<int>()));
            cursor = res.Json!["nextCursor"]?.GetValue<string>();
            if (cursor == null) return ids;
            Assert.Equal(limit, items.Count); // devamı varsa sayfa dolu
        }
        throw new InvalidOperationException("Sayfalar bitmedi");
    }

    [Fact]
    public async Task Gonderiler_ayni_zamanda_olsa_da_tekrarsiz_ve_eksiksiz_gelir()
    {
        var me = await TestClient.Register(api);
        var tag = NewTag();
        var created = new List<int>();
        for (var i = 0; i < 7; i++) created.Add(await PostWith(me, $"gönderi {i} #{tag}"));

        // 5 tanesi tam olarak aynı anda yazılmış olsun: sıra Id ile kararlı kalmalı
        var same = DateTime.UtcNow.AddMinutes(-3);
        await using (var db = api.NewDb())
            await db.Posts.Where(p => created.Take(5).Contains(p.Id)).ExecuteUpdateAsync(s => s.SetProperty(p => p.CreatedAt, same));

        foreach (var limit in new[] { 1, 2, 3, 7, 10 })
        {
            var ids = await AllPages(me, $"/api/posts?etiket={tag}", limit);
            Assert.Equal(7, ids.Count);
            Assert.Equal(7, ids.Distinct().Count());
            // Yeniden eskiye: önce sonradan yazılan 2, sonra aynı andakiler büyük Id'den küçüğe
            var expected = created.Skip(5).Reverse().Concat(created.Take(5).Reverse()).ToList();
            Assert.Equal(expected, ids);
        }
    }

    [Fact]
    public async Task Arada_yeni_gonderi_gelse_de_sonraki_sayfa_tekrar_etmez()
    {
        var me = await TestClient.Register(api);
        var tag = NewTag();
        for (var i = 0; i < 5; i++) await PostWith(me, $"eski {i} #{tag}");

        var first = await me.Get($"/api/posts?etiket={tag}&limit=3");
        var firstIds = first["items"].AsArray().Select(i => i!["id"]!.GetValue<int>()).ToList();
        var newest = await PostWith(me, $"yeni #{tag}");

        var second = await me.Get($"/api/posts?etiket={tag}&limit=3&cursor={Uri.EscapeDataString(first["nextCursor"].GetValue<string>())}");
        var secondIds = second["items"].AsArray().Select(i => i!["id"]!.GetValue<int>()).ToList();
        Assert.Equal(2, secondIds.Count);
        Assert.Empty(firstIds.Intersect(secondIds));
        Assert.DoesNotContain(newest, secondIds);
    }

    [Fact]
    public async Task Gonderi_suzgecleri_sayfalamada_korunur()
    {
        var me = await TestClient.Register(api);
        var other = await TestClient.Register(api);
        var tag = NewTag();
        var mine1 = await PostWith(me, $"benim 1 #{tag}");
        var theirs = await PostWith(other, $"onun #{tag}");
        var mine2 = await PostWith(me, $"benim 2 #{tag}");

        // kapsam=benim
        Assert.Equal(new[] { mine2, mine1 }, await AllPages(me, $"/api/posts?etiket={tag}&kapsam=benim", 1));
        // kapsam=takip: takip etmeden yalnızca kendi gönderilerim, takip edince onunki de
        Assert.Equal(new[] { mine2, mine1 }, await AllPages(me, $"/api/posts?etiket={tag}&kapsam=takip", 1));
        Assert.True((await me.Post($"/api/users/{other.Username}/follow")).Ok);
        Assert.Equal(new[] { mine2, theirs, mine1 }, await AllPages(me, $"/api/posts?etiket={tag}&kapsam=takip", 2));
        // since: gelecekteki bir andan sonra hiçbir şey
        Assert.Empty(await AllPages(me, $"/api/posts?etiket={tag}&since={DateTime.UtcNow.AddMinutes(5):O}", 2));
        // sirala=begeni: beğenilen öne
        Assert.True((await other.Post($"/api/begeni/post/{mine1}")).Ok);
        Assert.Equal(mine1, (await AllPages(me, $"/api/posts?etiket={tag}&sirala=begeni", 1))[0]);
        // Girişsiz "benim" yok
        Assert.Equal(401, (await TestClient.Guest(api).Get($"/api/posts?kapsam=benim&limit=5")).Code);
    }

    [Fact]
    public async Task Bozuk_ya_da_baska_siralamanin_imleci_reddedilir_ve_limit_sinirlidir()
    {
        var me = await TestClient.Register(api);
        Assert.Equal(400, (await me.Get("/api/posts?limit=5&cursor=bozuk!!")).Code);
        var tag = NewTag();
        for (var i = 0; i < 3; i++) await PostWith(me, $"x {i} #{tag}");
        var page = await me.Get($"/api/posts?etiket={tag}&limit=1");
        var cursor = Uri.EscapeDataString(page["nextCursor"].GetValue<string>());
        Assert.Equal(400, (await me.Get($"/api/posts?etiket={tag}&limit=1&sirala=begeni&cursor={cursor}")).Code);
        Assert.Equal(400, (await me.Get($"/api/projects?limit=1&sirala=ad&cursor={cursor}")).Code);

        var big = await me.Get("/api/posts?limit=1000");
        Assert.True(big["items"].AsArray().Count <= 50);
    }

    [Fact]
    public async Task Eski_bicim_istemciler_icin_liste_doner()
    {
        var me = await TestClient.Register(api);
        var tag = NewTag();
        await PostWith(me, $"eski istemci #{tag}");
        Assert.Single((await me.Get($"/api/posts?etiket={tag}")).Array);
        Assert.IsType<JsonArray>((await me.Get("/api/projects")).Json);
    }

    [Fact]
    public async Task Projeler_arama_dal_benim_ve_ada_gore_sayfalanir()
    {
        var me = await TestClient.Register(api);
        var other = await TestClient.Register(api);
        var word = "Prj" + Guid.NewGuid().ToString("N")[..8];
        async Task<int> P(TestClient who, string title, string category) =>
            (await who.Post("/api/projects", new { title = $"{title} {word}", description = "x", category }))["id"].GetValue<int>();
        var c = await P(me, "Cırcır", "robotik");
        var a = await P(me, "Araba", "robotik");
        var b = await P(other, "Balon", "robotik");
        var d = await P(me, "Devre", "elektronik");

        Assert.Equal(new[] { d, b, a, c }, await AllPages(me, $"/api/projects?ara={word}", 3));                 // yeni
        Assert.Equal(new[] { a, b, c, d }, await AllPages(me, $"/api/projects?ara={word}&sirala=ad", 1));        // ada göre
        Assert.Equal(new[] { b, a, c }, await AllPages(me, $"/api/projects?ara={word}&dal=robotik", 2));
        Assert.Equal(new[] { d, a, c }, await AllPages(me, $"/api/projects?ara={word}&kimin=benim", 2));
        var first = await me.Get($"/api/projects?ara={word.ToLowerInvariant()}&limit=1");                   // büyük/küçük harf
        Assert.Equal(4, first["total"].GetValue<int>());
        Assert.Equal(0, (await me.Get("/api/projects?ara=%25&limit=5"))["items"].AsArray()
            .Count(i => !i!["title"]!.GetValue<string>().Contains('%')));                                       // % joker değil
        Assert.Equal(400, (await me.Get("/api/projects?dal=yok&limit=5")).Code);

        // Ekip üyesi "benim" listesinde görür
        Assert.True((await me.Post($"/api/projects/{a}/ekip", new { username = other.Username })).Ok);
        Assert.Contains(a, await AllPages(other, $"/api/projects?ara={word}&kimin=benim", 5));

        var counts = await me.Get("/api/projects/sayilar");
        Assert.True(counts["categories"]["robotik"]!.GetValue<int>() >= 3);
        Assert.Equal(counts["total"].GetValue<int>(), counts["categories"].AsObject().Sum(kv => kv.Value!.GetValue<int>()));
    }

    [Fact]
    public async Task Mesajlar_son_50_ve_geriye_dogru_gizli_kanal_kurali_korunur()
    {
        var owner = await TestClient.Register(api);
        var stranger = await TestClient.Register(api);
        var oba = (await owner.Post("/api/obalar", new { name = "Sayfa " + Guid.NewGuid().ToString("N")[..5], description = "x", color = "#d4ff3d" }))["id"].GetValue<int>();
        var priv = (await owner.Post($"/api/obachannels/{oba}", new { name = "gizli-" + Guid.NewGuid().ToString("N")[..5], isPrivate = true, memberIds = Array.Empty<int>() }))["id"].GetValue<int>();
        // Yavaş mod art arda göndermeyi engeller: 60 mesaj doğrudan veritabanına yazılır
        var sent = new List<int>();
        await using (var db = api.NewDb())
        {
            var start = DateTime.UtcNow.AddHours(-1);
            var rows = Enumerable.Range(0, 60).Select(i => new Karalevha.API.Models.ObaMessage
            {
                ChannelId = priv, UserId = owner.Id, Content = $"m{i}", CreatedAt = start.AddSeconds(i)
            }).ToList();
            db.ObaMessages.AddRange(rows);
            await db.SaveChangesAsync();
            sent.AddRange(rows.Select(r => r.Id).Order());
        }

        var latest = (await owner.Get($"/api/obamessages/{priv}")).Array.Select(m => m!["id"]!.GetValue<int>()).ToList();
        Assert.Equal(sent.Skip(10), latest);                         // son 50, eskiden yeniye
        var older = (await owner.Get($"/api/obamessages/{priv}?beforeId={latest[0]}")).Array.Select(m => m!["id"]!.GetValue<int>()).ToList();
        Assert.Equal(sent.Take(10), older);
        Assert.Empty((await owner.Get($"/api/obamessages/{priv}?beforeId={older[0]}")).Array);

        Assert.Equal(403, (await stranger.Get($"/api/obamessages/{priv}?beforeId={latest[0]}")).Code);
        Assert.Equal(401, (await TestClient.Guest(api).Get($"/api/obamessages/{priv}?beforeId={latest[0]}")).Code);
    }

    [Fact]
    public async Task Ana_sayfa_sayilari_sunucuda_sayilir()
    {
        var me = await TestClient.Register(api);
        var stats = await me.Get("/api/istatistik");
        Assert.True(stats["mine"].GetValue<bool>());
        Assert.Equal(0, stats["posts"].GetValue<int>());
        await PostWith(me, "ilk paylaşım");
        await me.Post("/api/projects", new { title = "Sayım", description = "x", category = "diger" });
        stats = await me.Get("/api/istatistik");
        Assert.Equal(1, stats["posts"].GetValue<int>());
        Assert.Equal(1, stats["projects"].GetValue<int>());
        var guest = await TestClient.Guest(api).Get("/api/istatistik");
        Assert.False(guest["mine"].GetValue<bool>());
        Assert.True(guest["posts"].GetValue<int>() >= 1);
    }
}
