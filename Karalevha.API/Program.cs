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

builder.Services.AddControllers();
builder.Services.AddSignalR();
builder.Services.AddHealthChecks();
builder.Services.AddSingleton<ObaFileStorage>();
builder.Services.AddSingleton<CurrentUser>();
builder.Services.AddScoped<NotificationService>();

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
                if (!string.IsNullOrEmpty(token) && context.HttpContext.Request.Path.StartsWithSegments("/chathub"))
                    context.Token = token;
                return Task.CompletedTask;
            }
        };
    });

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

    // Gizli oba şifresi denemeleri: kişi başına dakikada 5
    options.AddPolicy("JoinLimiter", ctx =>
        RateLimitPartition.GetFixedWindowLimiter(
            ctx.User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? ctx.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            _ => new FixedWindowRateLimiterOptions
            {
                Window = TimeSpan.FromMinutes(1),
                PermitLimit = 5
            }));

    // Sohbete dosya gönderme: STL yüklemeden daha sık olur ama yine de sınırlı
    options.AddPolicy("ChatFileLimiter", ctx =>
        RateLimitPartition.GetFixedWindowLimiter(
            ctx.User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? ctx.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            _ => new FixedWindowRateLimiterOptions
            {
                Window = TimeSpan.FromMinutes(1),
                PermitLimit = 10
            }));
});

var app = builder.Build();

// YAYINDA (PRODUCTION) VERİTABANI MIGRATION'LARINI OTOMATİK UYGULA
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    db.Database.Migrate();

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

var provider = new Microsoft.AspNetCore.StaticFiles.FileExtensionContentTypeProvider();
// 3B model biçimleri: varsayılan tabloda olmayanlar statik olarak sunulmaz, bu yüzden açıkça eklenir
foreach (var ext in new[] { ".stl", ".obj", ".fbx", ".3mf" })
    provider.Mappings[ext] = "application/octet-stream";
provider.Mappings[".glb"] = "model/gltf-binary";
app.UseStaticFiles(new StaticFileOptions
{
    ContentTypeProvider = provider
});

app.UseAuthentication();
app.UseRateLimiter();
app.UseAuthorization();

app.MapControllers();
app.MapHub<Karalevha.API.Hubs.ChatHub>("/chathub");
app.MapHealthChecks("/health");
app.Map("/error", () => Results.Problem("Beklenmeyen bir hata oluştu.")).AllowAnonymous();

app.Run();
