using System.Text;
using System.Threading.RateLimiting;
using Karalevha.API.Data;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.Security.Claims;

// 1. WWWROOT KLASÖRÜNÜ BAŞTA OLUŞTUR
// ASP.NET Core çalışırken klasörü bulamazsa StaticFileProvider devreye girmez.
Directory.CreateDirectory(Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", "uploads", "stl"));

var builder = WebApplication.CreateBuilder(args);

// 2. FORWARDED HEADERS (Reverse Proxy / Render / Vercel vb. IP'leri okumak için)
builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    // Güvenlik: Eğer tüm proxy'lerden geliyorsa KnownNetworks/KnownProxies temizlenir.
    options.KnownNetworks.Clear();
    options.KnownProxies.Clear();
});

// 3. CORS
var allowedOrigins = builder.Configuration.GetSection("Cors:Origins").Get<string[]>() 
                     ?? new[] { "http://localhost:5173", "https://karalevha.vercel.app" };

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowReact", policy =>
    {
        policy.WithOrigins(allowedOrigins)
              .AllowAnyHeader()
              .AllowAnyMethod();
    });
});

builder.Services.AddControllers();

// 4. VERİTABANI
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));

// 5. JWT VE DOĞRULAMA (Key Uzunluğu Kontrolü)
var jwtKey = builder.Configuration["Jwt:Key"] ?? throw new InvalidOperationException("JWT Key is missing from configuration.");
if (Encoding.UTF8.GetByteCount(jwtKey) < 32)
{
    throw new InvalidOperationException("Jwt:Key en az 32 bayt olmalı. (HS256 için gerekli minumum uzunluk)");
}

var jwtIssuer = builder.Configuration["Jwt:Issuer"] ?? "Karalevha.API";
var jwtAudience = builder.Configuration["Jwt:Audience"] ?? "Karalevha.Client";

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
    });

// 6. RATE LIMITING (Parçalı / Partitioned Politikalar)
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;

    options.AddPolicy("AuthLimiter", ctx =>
        RateLimitPartition.GetFixedWindowLimiter(
            ctx.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            _ => new FixedWindowRateLimiterOptions
            {
                Window = TimeSpan.FromMinutes(1),
                PermitLimit = 5
            }));

    options.AddPolicy("UploadLimiter", ctx =>
        RateLimitPartition.GetFixedWindowLimiter(
            ctx.User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? ctx.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            _ => new FixedWindowRateLimiterOptions
            {
                Window = TimeSpan.FromMinutes(1),
                PermitLimit = 2
            }));
});

var app = builder.Build();

// 7. MIDDLEWARE SIRALAMASI
app.UseForwardedHeaders();         // 1. IP'yi düzelt
app.UseExceptionHandler("/error"); // 2. Hata yakala
app.UseHttpsRedirection();         // 3. HTTPS Zorla
app.UseCors("AllowReact");         // 4. CORS (Rate limiter hata verirse header'lar gitsin diye önce eklenir)

// STL dosyalarının indirilmesine izin ver
var provider = new Microsoft.AspNetCore.StaticFiles.FileExtensionContentTypeProvider();
provider.Mappings[".stl"] = "application/octet-stream";
app.UseStaticFiles(new StaticFileOptions
{
    ContentTypeProvider = provider
});

app.UseAuthentication();           // 5. Kimliği bul (UploadLimiter userId'yi okuyabilsin)
app.UseRateLimiter();              // 6. Hız sınırı
app.UseAuthorization();            // 7. Yetki kontrolü

app.MapControllers();

// Beklenmeyen hatalar için Endpoint
app.Map("/error", () => Results.Problem("Beklenmeyen bir hata oluştu.")).AllowAnonymous();

app.Run();
