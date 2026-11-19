using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace Karalevha.API.Tests;

/// <summary>Bir kullanıcının gözünden API: kayıt, JSON istekleri ve dosya yükleme</summary>
public sealed class TestClient
{
    private readonly HttpClient _http;
    public string Username { get; }
    public int Id { get; }
    /// <summary>Oturum çerezinin değeri (SignalR test bağlantısı için; tarayıcıda JavaScript bunu göremez)</summary>
    public string? SessionToken { get; private set; }

    private TestClient(HttpClient http, string username, int id)
    {
        _http = http;
        Username = username;
        Id = id;
    }

    /// <summary>Tarayıcı gibi: oturum çerezini saklar (CreateClient varsayılanı), güvenlik başlığını gönderir</summary>
    public static HttpClient Browser(ApiFactory api)
    {
        var http = api.CreateClient();
        http.DefaultRequestHeaders.Add("X-KaraLevha", "1");
        return http;
    }

    /// <summary>Girişsiz ziyaretçi</summary>
    public static TestClient Guest(ApiFactory api) => new(Browser(api), "misafir", 0);

    /// <summary>Yeni bir hesap açar ve giriş yapar. Ad verilmezse benzersiz bir ad üretilir.</summary>
    public static async Task<TestClient> Register(ApiFactory api, string? username = null)
    {
        username ??= "t_" + Guid.NewGuid().ToString("N")[..10];
        var http = Browser(api);
        var reg = await http.PostAsJsonAsync("/api/auth/register", new { username, email = $"{username}@example.test", password = ApiFactory.Password });
        if (reg.StatusCode != HttpStatusCode.OK && reg.StatusCode != HttpStatusCode.Created && reg.StatusCode != HttpStatusCode.Conflict && reg.StatusCode != HttpStatusCode.BadRequest)
            throw new InvalidOperationException($"Kayıt olmadı: {reg.StatusCode} {await reg.Content.ReadAsStringAsync()}");

        var login = await http.PostAsJsonAsync("/api/auth/login", new { usernameOrEmail = username, password = ApiFactory.Password });
        var body = JsonNode.Parse(await login.Content.ReadAsStringAsync())!;
        if (!login.IsSuccessStatusCode) throw new InvalidOperationException($"Giriş olmadı: {body}");
        // Oturum, yanıtın koyduğu HttpOnly çerezde; istemci onu kendisi taşır
        var cookie = login.Headers.TryGetValues("Set-Cookie", out var cookies)
            ? cookies.FirstOrDefault(c => c.StartsWith("kl_oturum=")) : null;
        return new TestClient(http, username, body["user"]!["id"]!.GetValue<int>())
        {
            SessionToken = cookie?.Split(';')[0]["kl_oturum=".Length..],
        };
    }

    /// <summary>Kulüp yöneticisi: ApiFactory.AdminName hesabı, rolü veritabanından verilir</summary>
    public static async Task<TestClient> Admin(ApiFactory api)
    {
        var client = await Register(api, ApiFactory.AdminName);
        await api.SetRoleAsync(ApiFactory.AdminName, Karalevha.API.Models.Roles.Admin);
        return client;
    }

    public async Task<Response> Get(string path) => await Response.From(await _http.GetAsync(path));
    public async Task<Response> Delete(string path) => await Response.From(await _http.DeleteAsync(path));
    public async Task<Response> Post(string path, object? body = null) =>
        await Response.From(await _http.PostAsync(path, body == null ? null : JsonContent.Create(body)));
    public async Task<Response> Put(string path, object body) => await Response.From(await _http.PutAsJsonAsync(path, body));

    /// <summary>multipart/form-data: alanlar ve tek dosya</summary>
    public async Task<Response> Upload(string path, string fileField, string fileName, byte[] data, IDictionary<string, string>? fields = null)
    {
        using var form = new MultipartFormDataContent();
        foreach (var (key, value) in fields ?? new Dictionary<string, string>())
            form.Add(new StringContent(value), key);
        var file = new ByteArrayContent(data);
        file.Headers.ContentType = new MediaTypeHeaderValue("application/octet-stream");
        form.Add(file, fileField, fileName);
        return await Response.From(await _http.PostAsync(path, form));
    }

    /// <summary>Ham yanıt (dosya indirme, başlıklar)</summary>
    public Task<HttpResponseMessage> Raw(string path, Action<HttpRequestMessage>? setup = null)
    {
        var req = new HttpRequestMessage(HttpMethod.Get, path);
        setup?.Invoke(req);
        return _http.SendAsync(req);
    }
}

public sealed record Response(HttpStatusCode Status, JsonNode? Json, string Text)
{
    public static async Task<Response> From(HttpResponseMessage res)
    {
        var text = await res.Content.ReadAsStringAsync();
        JsonNode? json = null;
        try { if (text.Length > 0) json = JsonNode.Parse(text); } catch (JsonException) { }
        return new Response(res.StatusCode, json, text);
    }

    public int Code => (int)Status;
    public JsonNode this[string key] => Json?[key] ?? throw new KeyNotFoundException($"{key} yok: {Text}");
    public JsonArray Array => Json as JsonArray ?? throw new InvalidOperationException($"Dizi değil: {Text}");
    public bool Ok => Code is >= 200 and < 300;
    public override string ToString() => $"{Code} {Text}";
}

public static class TestFiles
{
    public static readonly byte[] Stl = "solid t\nfacet normal 0 0 1\nouter loop\nvertex 0 0 0\nvertex 1 0 0\nvertex 0 1 0\nendloop\nendfacet\nendsolid t\n"u8.ToArray();

    /// <summary>1x1 PNG</summary>
    public static readonly byte[] Png = Convert.FromHexString("89504E470D0A1A0A0000000D49484452000000010000000108060000001F15C4890000000D49444154789C6360000002000154A24F5D0000000049454E44AE426082");

    public static byte[] Text(string s) => System.Text.Encoding.UTF8.GetBytes(s);
}
