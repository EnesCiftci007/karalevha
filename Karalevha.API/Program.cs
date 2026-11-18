using System.Text;
using System.Threading.RateLimiting;
using Karalevha.API.Data;
using Karalevha.API.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.Security.Claims;

Directory.CreateDirectory(Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", "uploads", "stl"));
Directory.CreateDirectory(Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", "uploads", "models"));
Directory.CreateDirectory(Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", "uploads", "makes"));

var builder = WebApplication.CreateBuilder(args);

builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    options.KnownNetworks.Clear();
    options.KnownProxies.Clear();
});

var allowedOrigins = builder.Configuration.GetSection("Cors:Origins").Get<string[]>()
                     ?? (builder.Environment.IsDevelopment()
                        ? new[] { "http://localhost:5173" }
                        : new[] { "https://karalevha.vercel.app" });

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowReact", policy =>
    {
        policy.WithOrigins(allowedOrigins)
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

// Askıdaki hesaplar okuyabilir ama yazamaz (Filters/BanFilter.cs)
builder.Services.AddControllers(options => options.Filters.Add<Karalevha.API.Filters.BanFilter>());
builder.Services.AddSignalR();
builder.Services.AddHealthChecks();
builder.Services.AddSingleton<ObaFileStorage>();
// Yüklenen dosyaların deposu: yerel disk ya da S3 uyumlu (Cloudflare R2). Bkz. Services/FileStore.cs
builder.Services.AddFileStore(builder.Configuration);
builder.Services.AddSingleton<CurrentUser>();
builder.Services.AddScoped<NotificationService>();
builder.Services.AddScoped<ObaAccess>();
builder.Services.AddHttpClient<IEmailService, EmailService>();
builder.Services.AddMemoryCache();
builder.Services.AddHttpClient<RepoService>();

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));

var jwtKey = builder.Configuration["Jwt:Key"] ?? throw new InvalidOperationException("JWT Key is missing from configuration.");
if (Encoding.UTF8.GetByteCount(jwtKey) < 32)
{
    throw new InvalidOperationException("Jwt:Key en az 32 bayt olmalı. (HS256 için gerekli minimum uzunluk)");
}

var jwtIssuer = builder.Configuration["Jwt:Issuer"] ?? throw new InvalidOperationException("Jwt:Issuer missing");
var jwtAudience = builder.Configuration["Jwt:Audience"] ?? throw new InvalidOperationException("Jwt:Audience missing");

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = jwtIssuer,
            ValidAudience = jwtAudience,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey))
        };
        // WebSocket bağlantıları başlık gönderemez; SignalR jetonu sorgu dizesinde taşır
        options.Events = new JwtBearerEvents
        {
            OnMessageReceived = context =>
            {
                var token = context.Request.Query["access_token"];
                var path = context.HttpContext.Request.Path;
                if (!string.IsNullOrEmpty(token) && (path.StartsWithSegments("/chathub") || path.StartsWithSegments("/notificationhub")))
                    context.Token = token;
                return Task.CompletedTask;
            }
        };
    });

// Testlerde (RateLimits:Disabled) sınırlar fiilen kapanır; canlıda her zaman açık
var rateLimitsOff = builder.Configuration.GetValue<bool>("RateLimits:Disabled");
int Limit(int permits) => rateLimitsOff ? 1_000_000 : permits;

builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;

    options.AddPolicy("AuthLimiter", ctx =>
        RateLimitPartition.GetFixedWindowLimiter(
            ctx.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            _ => new FixedWindowRateLimiterOptions
            {
                Window = TimeSpan.FromMinutes(1),
                PermitLimit = Limit(5)
            }));

    options.AddPolicy("UploadLimiter", ctx =>
        RateLimitPartition.GetFixedWindowLimiter(
            ctx.User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? ctx.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            _ => new FixedWindowRateLimiterOptions
            {
                Window = TimeSpan.FromMinutes(1),
                PermitLimit = Limit(2)
            }));

    // Gizli oba şifresi denemeleri: kişi başına dakikada 5
    // Proje parçaları (model, çizim, devre, kod): proje kurulurken birkaç dosya art arda yüklenir
    options.AddPolicy("PartUploadLimiter", ctx =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: ctx.User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value ?? ctx.Connection.RemoteIpAddress?.ToString() ?? "anon",
            _ => new FixedWindowRateLimiterOptions
            {
                Window = TimeSpan.FromMinutes(1),
                PermitLimit = Limit(20)
            }));
    options.AddPolicy("JoinLimiter", ctx =>
        RateLimitPartition.GetFixedWindowLimiter(
            ctx.User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? ctx.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            _ => new FixedWindowRateLimiterOptions
            {
                Window = TimeSpan.FromMinutes(1),
                PermitLimit = Limit(5)
            }));

    // Sohbete dosya gönderme: STL yüklemeden daha sık olur ama yine de sınırlı
    options.AddPolicy("ChatFileLimiter", ctx =>
        RateLimitPartition.GetFixedWindowLimiter(
            ctx.User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? ctx.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            _ => new FixedWindowRateLimiterOptions
            {
                Window = TimeSpan.FromMinutes(1),
                PermitLimit = Limit(10)
            }));
});

var app = builder.Build();

// Tek seferlik: eski yerel dosyaları yapılandırılmış depoya (ör. R2) kopyala ve çık
if (args.Contains("--depoya-aktar"))
    return await FileStoreSetup.CopyLocalToStoreAsync(app.Services);

// YAYINDA (PRODUCTION) VERİTABANI MIGRATION'LARINI OTOMATİK UYGULA
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    db.Database.Migrate();

    // Yapılandırmadaki Owner/Admin rollerini veritabanına yaz, yöneticileri belleğe al
    await app.Services.GetRequiredService<CurrentUser>().LoadAsync(db);

    // Eski sürümlerde oba şifreleri düz metin saklanıyordu; kalanları bir kerelik BCrypt özetine çevir
    var plainPasswords = db.Obalar.Where(o => o.JoinPassword != null && !o.JoinPassword.StartsWith("$2")).ToList();
    foreach (var oba in plainPasswords)
        oba.JoinPassword = BCrypt.Net.BCrypt.HashPassword(oba.JoinPassword!.Trim());
    if (plainPasswords.Count > 0) db.SaveChanges();
}

app.UseForwardedHeaders();
app.UseExceptionHandler("/error");
app.UseHttpsRedirection();
app.UseCors("AllowReact");

// Yüklenen dosyalar diskte değil depoda (IFileStore): /uploads/... adresleri UploadsEndpoint'ten sunulur.
// wwwroot'ta başka statik dosya yok, statik dosya sunucusu gerekmiyor.

app.UseAuthentication();
app.UseRateLimiter();
app.UseAuthorization();

app.MapControllers();
app.MapUploads();
app.MapHub<Karalevha.API.Hubs.ChatHub>("/chathub");
app.MapHub<Karalevha.API.Hubs.NotificationHub>("/notificationhub");
app.MapHealthChecks("/health");
app.Map("/error", () => Results.Problem("Beklenmeyen bir hata oluştu.")).AllowAnonymous();

app.Run();
return 0;

/// <summary>Entegrasyon testleri (WebApplicationFactory) için görünür</summary>
public partial class Program { }
