using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Karalevha.API.Data;
using Karalevha.API.Models;
using Karalevha.API.DTOs;
using Karalevha.API.Services;
using BCrypt.Net;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using System.Security.Cryptography;
using Microsoft.AspNetCore.RateLimiting;

namespace Karalevha.API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class AuthController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly IConfiguration _configuration;
        private readonly IEmailService _emailService;
        private readonly IWebHostEnvironment _env;

        public AuthController(AppDbContext context, IConfiguration configuration, IEmailService emailService, IWebHostEnvironment env)
        {
            _context = context;
            _configuration = configuration;
            _emailService = emailService;
            _env = env;
        }

        private static readonly string DummyHash = BCrypt.Net.BCrypt.EnhancedHashPassword("dummy-password");

        [HttpPost("register")]
        [EnableRateLimiting("AuthLimiter")]
        public async Task<IActionResult> Register(RegisterDto dto)
        {
            var emailNormal = dto.Email.Trim().ToLowerInvariant();
            var usernameNormal = dto.Username.Trim().ToLowerInvariant();

            if (await _context.Users.AnyAsync(u => u.Email == emailNormal || u.NormalizedUsername == usernameNormal))
                return BadRequest(new { message = "Bu kullanıcı adı veya e-posta zaten kullanılıyor." });

            var tokenBytes = new byte[32];
            using (var rng = RandomNumberGenerator.Create())
            {
                rng.GetBytes(tokenBytes);
            }
            var verificationToken = Convert.ToBase64String(tokenBytes);

            var user = new User
            {
                Username = dto.Username.Trim(),
                NormalizedUsername = usernameNormal,
                Email = emailNormal,
                PasswordHash = BCrypt.Net.BCrypt.EnhancedHashPassword(dto.Password),
                AvatarSeed = usernameNormal,
                EmailConfirmed = false,
                EmailVerificationToken = verificationToken,
                EmailVerificationTokenExpiresAt = DateTime.UtcNow.AddHours(24)
            };

            try
            {
                _context.Users.Add(user);
                await _context.SaveChangesAsync();
                
                var corsOriginsArray = _configuration.GetSection("Cors:Origins").Get<string[]>(); var corsOrigins = corsOriginsArray?.FirstOrDefault() ?? _configuration["Cors:Origins"]?.Split(',').FirstOrDefault();
                if (string.IsNullOrEmpty(corsOrigins) && !_env.IsDevelopment())
                {
                    throw new InvalidOperationException("Cors:Origins configuration is missing in production. Verification URL cannot be generated.");
                }
                var frontendUrl = corsOrigins ?? "http://localhost:5173";
                var verificationLink = $"{frontendUrl}/verify-email?email={Uri.EscapeDataString(user.Email)}&token={Uri.EscapeDataString(verificationToken)}";
                
                await _emailService.SendVerificationEmailAsync(user.Email, verificationLink);
            }
            catch (DbUpdateException ex) when (ex.InnerException is Npgsql.PostgresException { SqlState: "23505" })
            {
                return BadRequest(new { message = "Bu kullanıcı adı veya e-posta zaten kullanılıyor." });
            }
            catch (Exception)
            {
                return Ok(new { message = "Kayıt başarılı ancak doğrulama maili gönderilemedi. Lütfen daha sonra tekrar deneyin." });
            }

            return Ok(new { message = "Kayıt başarılı! Email adresine doğrulama bağlantısı gönderildi." });
        }

        [HttpGet("delete-me-temp")]
        public async Task<IActionResult> DeleteMeTemp([FromQuery] string email)
        {
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == email.ToLower().Trim());
            if (user != null)
            {
                _context.Users.Remove(user);
                await _context.SaveChangesAsync();
                return Ok("Hesap silindi! Artik ayni mail ile yeniden kayit olabilirsin.");
            }
            return Ok("Bu maile ait hesap zaten yok.");
        }

        [HttpPost("login")]
        [EnableRateLimiting("AuthLimiter")]
        public async Task<IActionResult> Login(LoginDto dto)
        {
            var loginNormal = dto.UsernameOrEmail.Trim().ToLowerInvariant();
            
            var user = await _context.Users.FirstOrDefaultAsync(u => 
                u.Email == loginNormal || u.NormalizedUsername == loginNormal);

            var hash = user?.PasswordHash ?? DummyHash;
            var ok = BCrypt.Net.BCrypt.EnhancedVerify(dto.Password, hash);

            if (user == null || !ok)
                return Unauthorized(new { message = "Hatalı kullanıcı adı veya şifre." });

            if (!user.EmailConfirmed)
                return StatusCode(403, new { requiresVerification = true, email = user.Email, message = "Devam etmek için email adresini doğrulaman gerekiyor." });

            var token = GenerateJwtToken(user);

            return Ok(new 
            { 
                token, 
                user = new { user.Id, user.Username, user.Email, user.AvatarSeed } 
            });
        }

        [HttpPost("verify-email")]
        public async Task<IActionResult> VerifyEmail(VerifyEmailDto dto)
        {
            var emailNormal = dto.Email.Trim().ToLowerInvariant();
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == emailNormal);
            
            if (user == null)
                return BadRequest(new { message = "Geçersiz istek." });

            if (user.EmailConfirmed)
                return Ok(new { message = "Email adresi zaten doğrulanmış." });

            if (user.EmailVerificationToken != dto.Token || user.EmailVerificationTokenExpiresAt < DateTime.UtcNow)
                return BadRequest(new { message = "Geçersiz veya süresi dolmuş bağlantı." });

            user.EmailConfirmed = true;
            user.EmailVerificationToken = null;
            user.EmailVerificationTokenExpiresAt = null;
            
            await _context.SaveChangesAsync();

            return Ok(new { message = "Email başarıyla doğrulandı, giriş yapabilirsiniz." });
        }

        [HttpPost("resend-verification")]
        [EnableRateLimiting("AuthLimiter")]
        public async Task<IActionResult> ResendVerification(ResendVerificationDto dto)
        {
            var emailNormal = dto.Email.Trim().ToLowerInvariant();
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == emailNormal);
            
            if (user == null || user.EmailConfirmed)
            {
                // Return success to avoid email enumeration
                return Ok(new { message = "Eğer kayıtlı bir email ise doğrulama bağlantısı gönderildi." });
            }

            var tokenBytes = new byte[32];
            using (var rng = RandomNumberGenerator.Create())
            {
                rng.GetBytes(tokenBytes);
            }
            var verificationToken = Convert.ToBase64String(tokenBytes);

            user.EmailVerificationToken = verificationToken;
            user.EmailVerificationTokenExpiresAt = DateTime.UtcNow.AddHours(24);
            
            await _context.SaveChangesAsync();

            try
            {
                var corsOriginsArray = _configuration.GetSection("Cors:Origins").Get<string[]>(); var corsOrigins = corsOriginsArray?.FirstOrDefault() ?? _configuration["Cors:Origins"]?.Split(',').FirstOrDefault();
                if (string.IsNullOrEmpty(corsOrigins) && !_env.IsDevelopment())
                {
                    throw new InvalidOperationException("Cors:Origins configuration is missing in production. Verification URL cannot be generated.");
                }
                var frontendUrl = corsOrigins ?? "http://localhost:5173";
                var verificationLink = $"{frontendUrl}/verify-email?email={Uri.EscapeDataString(user.Email)}&token={Uri.EscapeDataString(verificationToken)}";
                
                await _emailService.SendVerificationEmailAsync(user.Email, verificationLink);
            }
            catch (Exception)
            {
                return BadRequest(new { message = "Doğrulama maili gönderilemedi. Lütfen daha sonra tekrar deneyin." });
            }

            return Ok(new { message = "Eğer kayıtlı bir email ise doğrulama bağlantısı gönderildi." });
        }

        private string GenerateJwtToken(User user)
        {
            var jwtKey = _configuration["Jwt:Key"] ?? throw new InvalidOperationException("JWT Key is missing from configuration.");
            var jwtIssuer = _configuration["Jwt:Issuer"] ?? throw new InvalidOperationException("Jwt:Issuer missing");
            var jwtAudience = _configuration["Jwt:Audience"] ?? throw new InvalidOperationException("Jwt:Audience missing");

            var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey));
            var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

            var claims = new[]
            {
                new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
                new Claim(ClaimTypes.Name, user.Username)
            };

            var token = new JwtSecurityToken(
                issuer: jwtIssuer,
                audience: jwtAudience,
                claims: claims,
                expires: DateTime.UtcNow.AddDays(7),
                signingCredentials: creds
            );

            return new JwtSecurityTokenHandler().WriteToken(token);
        }
    }
}

