using System.Text;
using System.Threading.RateLimiting;
using Karalevha.API.Data;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

var builder = WebApplication.CreateBuilder(args);

// Hız Sınırı (Rate Limiting) - Güvenlik için eklendi
builder.Services.AddRateLimiter(options =>
{
    options.AddFixedWindowLimiter("AuthLimiter", opt =>
    {
        opt.Window = TimeSpan.FromMinutes(1);
        opt.PermitLimit = 5; // Dakikada en fazla 5 giriş/kayıt denemesi
    });
    
    options.AddFixedWindowLimiter("UploadLimiter", opt =>
    {
        opt.Window = TimeSpan.FromMinutes(1);
        opt.PermitLimit = 2; // Dakikada en fazla 2 dosya yükleme
    });
});

// CORS: Hem Localhost hem de Vercel yayınına izin ver
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
builder.Services.AddEndpointsApiExplorer();

// PostgreSQL Yapılandırması
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));

// JWT Authentication
var jwtKey = builder.Configuration["Jwt:Key"] ?? throw new InvalidOperationException("JWT Key is missing from configuration. Set it via dotnet user-secrets or environment variables.");
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

var app = builder.Build();

app.UseExceptionHandler("/error"); // Genel Hata Yakalayıcı (Production'da hassas verileri gizler)
app.UseHttpsRedirection();         // Https zorlaması
app.UseRateLimiter();              // Hız sınırını devreye sok
app.UseCors("AllowReact");         // CORS en üstte olmalı!

// STL dosyalarının indirilmesine izin ver
var provider = new Microsoft.AspNetCore.StaticFiles.FileExtensionContentTypeProvider();
provider.Mappings[".stl"] = "application/octet-stream";

app.UseStaticFiles(new StaticFileOptions
{
    ContentTypeProvider = provider
});

app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
app.Run();
