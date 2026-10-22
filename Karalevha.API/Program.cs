using System.Text;
using System.Threading.RateLimiting;
using Karalevha.API.Data;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.Security.Claims;

Directory.CreateDirectory(Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", "uploads", "stl"));

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
builder.Services.AddHttpClient<Karalevha.API.Services.IEmailService, Karalevha.API.Services.EmailService>();
builder.Services.AddScoped<Karalevha.API.Services.INotificationService, Karalevha.API.Services.NotificationService>();

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));

var jwtKey = builder.Configuration["Jwt:Key"] ?? throw new InvalidOperationException("JWT Key is missing from configuration.");
if (Encoding.UTF8.GetByteCount(jwtKey) < 32)
{
    throw new InvalidOperationException("Jwt:Key en az 32 bayt olmalıdır. (HS256 için gerekli minimum uzunluk)");
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
        options.Events = new JwtBearerEvents
        {
            OnMessageReceived = context =>
            {
                var accessToken = context.Request.Query["access_token"];
                var path = context.HttpContext.Request.Path;
                if (!string.IsNullOrEmpty(accessToken) &&
                    (path.StartsWithSegments("/chathub") || path.StartsWithSegments("/notificationhub")))
                {
                    context.Token = accessToken;
                }
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
});

var app = builder.Build();

// YAYINDA (PRODUCTION) VERİTABANI MIGRATION'LARINI OTOMATİK UYGULA
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    db.Database.Migrate();

    // Platform sahibi yalnızca yapılandırmayla belirlenir (örn. Render'da OwnerUsername=SERO).
    // Kodda varsayılan bir kullanıcı adı OLMAMALI: aksi halde o adı ilk kaydeden kişi Owner olurdu.
    var ownerUsername = (app.Configuration["OwnerUsername"] ?? app.Configuration["Admin:OwnerUsername"])?
        .Trim()
        .ToLowerInvariant();
    if (!string.IsNullOrEmpty(ownerUsername))
    {
        var ownerUser = db.Users.FirstOrDefault(u => u.NormalizedUsername == ownerUsername);
        if (ownerUser == null)
        {
            app.Logger.LogWarning("OwnerUsername '{Owner}' olarak ayarlı ama bu kullanıcı bulunamadı.", ownerUsername);
        }
        else if (ownerUser.Role != "Owner")
        {
            ownerUser.Role = "Owner";
            db.SaveChanges();
            app.Logger.LogInformation("{Owner} kullanıcısına Owner rolü atandı.", ownerUser.Username);
        }
    }
}

app.UseForwardedHeaders();
app.UseCors("AllowReact");
app.UseExceptionHandler("/error");
if (app.Environment.IsDevelopment())
{
    app.UseHttpsRedirection();
}

var provider = new Microsoft.AspNetCore.StaticFiles.FileExtensionContentTypeProvider();
provider.Mappings[".stl"] = "application/octet-stream";
app.UseStaticFiles(new StaticFileOptions
{
    ContentTypeProvider = provider
});

app.UseAuthentication();
app.UseRateLimiter();
app.UseAuthorization();

app.MapControllers();
app.MapHub<Karalevha.API.Hubs.ChatHub>("/chathub");
app.MapHub<Karalevha.API.Hubs.NotificationHub>("/notificationhub");
app.MapHealthChecks("/health");
app.Map("/error", () => Results.Problem("Beklenmeyen bir hata oluştu.")).AllowAnonymous();

app.Run();






