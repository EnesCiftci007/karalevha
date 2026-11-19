using System.Collections.Concurrent;
using System.Text.Json;
using Microsoft.AspNetCore.Http.Connections;
using Microsoft.AspNetCore.SignalR;
using Microsoft.AspNetCore.SignalR.Client;

namespace Karalevha.API.Tests;

/// <summary>
/// Gizli kanal güvenliği, gerçek SignalR bağlantısıyla: erişim kalkınca açık bağlantı yeni mesaj alamaz,
/// yeniden katılamaz, REST'ten okuyamaz; açık kanallar etkilenmez.
/// </summary>
[Collection(ApiCollection.Name)]
public class ChatAccessTests(ApiFactory api)
{
    /// <summary>Canlı bağlantı: gelen mesajları ve erişim bildirimlerini toplar</summary>
    private sealed class Listener : IAsyncDisposable
    {
        public HubConnection Connection { get; }
        public ConcurrentQueue<string> Messages { get; } = new();
        public ConcurrentQueue<int> Revoked { get; } = new();

        public Listener(HubConnection connection)
        {
            Connection = connection;
            connection.On<JsonElement>("ReceiveMessage", m => Messages.Enqueue(m.GetProperty("content").GetString() ?? ""));
            connection.On<int>("KanalErisimiKalkti", id => Revoked.Enqueue(id));
        }

        public Task Join(int channelId) => Connection.InvokeAsync("JoinChannel", channelId.ToString());
        public ValueTask DisposeAsync() => Connection.DisposeAsync();
    }

    private async Task<Listener> Connect(TestClient? who)
    {
        api.CreateClient(); // sunucu ayakta olsun
        var connection = new HubConnectionBuilder()
            .WithUrl(new Uri(api.Server.BaseAddress, "chathub"), o =>
            {
                o.HttpMessageHandlerFactory = _ => api.Server.CreateHandler();
                o.Transports = HttpTransportType.LongPolling;
                if (who?.SessionToken is { } token) o.AccessTokenProvider = () => Task.FromResult<string?>(token);
            })
            .Build();
        var listener = new Listener(connection);
        await connection.StartAsync();
        return listener;
    }

    private static async Task<bool> Eventually(Func<bool> condition, int ms = 5000)
    {
        var until = DateTime.UtcNow.AddMilliseconds(ms);
        while (DateTime.UtcNow < until)
        {
            if (condition()) return true;
            await Task.Delay(50);
        }
        return condition();
    }

    /// <summary>Açık oba, üye ve üyeyi içeren gizli kanal</summary>
    private async Task<(TestClient Owner, TestClient Member, int ObaId, int PrivateChannel, int PublicChannel)> Setup()
    {
        var owner = await TestClient.Register(api);
        var member = await TestClient.Register(api);
        var oba = (await owner.Post("/api/obalar", new { name = "Kanal testi " + Guid.NewGuid().ToString("N")[..5], description = "x", color = "#d4ff3d" }))["id"].GetValue<int>();
        Assert.True((await member.Post($"/api/obalar/{oba}/join", new { })).Ok);
        var priv = await owner.Post($"/api/obachannels/{oba}", new { name = "gizli-" + Guid.NewGuid().ToString("N")[..5], isPrivate = true, memberIds = new[] { member.Id } });
        Assert.True(priv.Ok, priv.ToString());
        var pub = (await owner.Get($"/api/obachannels/{oba}")).Json!.AsArray()
            .First(c => !c!["isPrivate"]!.GetValue<bool>())!["id"]!.GetValue<int>();
        return (owner, member, oba, priv["id"].GetValue<int>(), pub);
    }

    private static Task<Response> Say(TestClient who, int channel, string text) =>
        who.Post($"/api/obamessages/{channel}", new { content = text });

    [Fact]
    public async Task Yetkili_katilir_yetkisiz_katilamaz()
    {
        var (owner, member, _, priv, _) = await Setup();
        var stranger = await TestClient.Register(api);

        await using var m = await Connect(member);
        await m.Join(priv);
        await Say(owner, priv, "merhaba ekip");
        Assert.True(await Eventually(() => m.Messages.Contains("merhaba ekip")));

        await using var s = await Connect(stranger);
        await Assert.ThrowsAsync<HubException>(() => s.Join(priv));
        await using var guest = await Connect(null);
        await Assert.ThrowsAsync<HubException>(() => guest.Join(priv));
    }

    [Fact]
    public async Task Kanaldan_cikarilan_acik_baglantiyla_mesaj_alamaz_geri_katilamaz()
    {
        var (owner, member, _, priv, _) = await Setup();
        await using var m = await Connect(member);
        await m.Join(priv);

        // Kurucu kanalın kişi listesinden üyeyi çıkarır
        var update = await owner.Put($"/api/obachannels/kanal/{priv}", new { name = "gizli-kanal", isPrivate = true, memberIds = Array.Empty<int>() });
        Assert.True(update.Ok, update.ToString());
        Assert.True(await Eventually(() => m.Revoked.Contains(priv)));

        await Say(owner, priv, "artık görmemeli");
        await Task.Delay(1500);
        Assert.DoesNotContain("artık görmemeli", m.Messages);
        await Assert.ThrowsAsync<HubException>(() => m.Join(priv));               // eski bağlantıyla geri katılamaz
        Assert.True((await member.Get($"/api/obamessages/{priv}")).Code is 403 or 404); // REST de kapalı
    }

    [Fact]
    public async Task Acik_kanal_gizlenince_disarida_kalan_cikar()
    {
        var (owner, member, _, _, pub) = await Setup();
        await using var m = await Connect(member);
        await using var guest = await Connect(null);
        await m.Join(pub);
        await guest.Join(pub);

        Assert.True((await owner.Put($"/api/obachannels/kanal/{pub}", new { name = "genel", isPrivate = true, memberIds = Array.Empty<int>() })).Ok);
        Assert.True(await Eventually(() => m.Revoked.Contains(pub) && guest.Revoked.Contains(pub)));
        await Say(owner, pub, "yalnızca kurucu");
        await Task.Delay(1500);
        Assert.Empty(m.Messages);
        Assert.Empty(guest.Messages);
    }

    [Fact]
    public async Task Obadan_ayrilan_ve_silinen_oba_baglantilari_kesilir()
    {
        var (owner, member, oba, priv, pub) = await Setup();
        await using var m = await Connect(member);
        await m.Join(priv);
        await m.Join(pub);

        Assert.True((await member.Post($"/api/obalar/{oba}/leave")).Ok);
        // Gizli kanaldan çıkar; açık obanın açık kanalını herkes okuyabildiği için o kalır
        Assert.True(await Eventually(() => m.Revoked.Contains(priv)));
        Assert.DoesNotContain(pub, m.Revoked);

        await using var o = await Connect(owner);
        await o.Join(pub);
        Assert.True((await owner.Delete($"/api/obalar/{oba}")).Ok);
        Assert.True(await Eventually(() => o.Revoked.Contains(pub) && m.Revoked.Contains(pub)));
    }

    [Fact]
    public async Task Gizli_kanal_dosyasi_erisimi_kalkinca_okunamaz()
    {
        var (owner, member, _, priv, _) = await Setup();
        var file = await owner.Upload($"/api/obamessages/{priv}/file", "file", "not.txt", TestFiles.Text("gizli"), new Dictionary<string, string> { ["content"] = "dosya" });
        Assert.True(file.Ok, file.ToString());
        var url = $"/api/obamessages/file/{file["id"]}";
        Assert.Equal(200, (int)(await member.Raw(url)).StatusCode);

        await owner.Put($"/api/obachannels/kanal/{priv}", new { name = "gizli-kanal", isPrivate = true, memberIds = Array.Empty<int>() });
        Assert.Equal(403, (int)(await member.Raw(url)).StatusCode);
        Assert.Equal(200, (int)(await owner.Raw(url)).StatusCode);
    }

    [Fact]
    public async Task Acik_kanal_herkese_calismaya_devam_eder()
    {
        var (owner, _, _, _, pub) = await Setup();
        await using var guest = await Connect(null);
        await guest.Join(pub);
        await Say(owner, pub, "herkese merhaba");
        Assert.True(await Eventually(() => guest.Messages.Contains("herkese merhaba")));
        Assert.Empty(guest.Revoked);
    }

    [Fact]
    public async Task Hesabi_silinenin_baglantisi_kesilir()
    {
        var (owner, member, _, priv, _) = await Setup();
        await using var m = await Connect(member);
        await m.Join(priv);
        Assert.True((await member.Post("/api/auth/hesabi-sil", new { password = ApiFactory.Password })).Ok);
        Assert.True(await Eventually(() => m.Connection.State == HubConnectionState.Disconnected));
        await Say(owner, priv, "silinen görmemeli");
        await Task.Delay(1000);
        Assert.DoesNotContain("silinen görmemeli", m.Messages);
    }
}
