using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Karalevha.API.Data;
using Karalevha.API.Models;
using Karalevha.API.DTOs;
using BCrypt.Net;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.RateLimiting;
using Karalevha.API.Services;
using Microsoft.AspNetCore.Authorization;
using System.Security.Cryptography;

namespace Karalevha.API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class AuthController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly IConfiguration _configuration;
        private readonly CurrentUser _current;
        private readonly IEmailService _email;
        private readonly IWebHostEnvironment _env;

        public AuthController(AppDbContext context, IConfiguration configuration, CurrentUser current, IEmailService email, IWebHostEnvironment env)
        {
            _context = context;
            _configuration = configuration;
            _current = current;
            _email = email;
            _env = env;
        }

        /// <summary>
        /// E-posta doğrulaması posta altyapısı (Resend) kurulana kadar kapalı. Açmak için:
        /// Auth:RequireEmailVerification=true ve Resend:ApiKey. Kapalıyken hesaplar doğrulanmış sayılır.
        /// </summary>
        private bool RequireEmailVerification => _configuration.GetValue("Auth:RequireEmailVerification", false);

        /// <summary>Doğrulama bağlantısı 24 saat geçerli; yeniden gönderim en erken 1 dakika sonra</summary>
        private static readonly TimeSpan VerificationLifetime = TimeSpan.FromHours(24);
        private static readonly TimeSpan ResendCooldown = TimeSpan.FromMinutes(1);

        private static string NewToken() =>
            Convert.ToBase64String(RandomNumberGenerator.GetBytes(32)).Replace('+', '-').Replace('/', '_').TrimEnd('=');

        /// <summary>Veritabanında kodun kendisi değil SHA-256 özeti durur: veri sızsa da bağlantı üretilemez</summary>
        private static string HashToken(string token) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(token)));

        /// <summary>Yeni doğrulama kodu üretir, özetini kullanıcıya yazar, kodun kendisini döner (e-postaya)</summary>
        private static string IssueVerification(User user)
        {
            var token = NewToken();
            user.EmailVerificationToken = HashToken(token);
            user.EmailVerificationTokenExpiresAt = DateTime.UtcNow.Add(VerificationLifetime);
            return token;
        }

        private static object UserDto(User user) => new
        {
            user.Id,
            user.Username,
            user.Email,
            user.AvatarSeed,
            user.Role,
            IsAdmin = Roles.IsStaff(user.Role),
            BannedUntil = user.BannedUntil > DateTime.UtcNow ? user.BannedUntil : null,
        };

        private string FrontendBaseUrl()
        {
            var origin = _configuration.GetSection("Cors:Origins").Get<string[]>()?.FirstOrDefault();
            if (!string.IsNullOrEmpty(origin)) return origin.TrimEnd('/');
            if (_env.IsDevelopment()) return "http://localhost:5173";
            throw new InvalidOperationException("Cors:Origins tanımlı değil; doğrulama bağlantısı üretilemiyor.");
        }

        private Task SendVerification(User user, string token) =>
            _email.SendVerificationEmailAsync(user.Email,
                $"{FrontendBaseUrl()}/verify-email?email={Uri.EscapeDataString(user.Email)}&token={Uri.EscapeDataString(token)}");

        private static readonly string DummyHash = BCrypt.Net.BCrypt.EnhancedHashPassword("dummy-password");

        [HttpPost("register")]
        [EnableRateLimiting("AuthLimiter")]
        public async Task<IActionResult> Register(RegisterDto dto)
        {
            var emailNormal = dto.Email.Trim().ToLowerInvariant();
            var usernameNormal = dto.Username.Trim().ToLowerInvariant();

            // Başkasının adresiyle açılıp hiç doğrulanmayan hesaplar adresi ve adı sonsuza dek kilitlemesin:
            // bağlantısının süresi dolmuşsa yeni kayıt onun yerini alır. (Doğrulanmamış hesap giriş
            // yapamadığı için hiçbir içeriği yoktur.)
            await _context.Users
                .Where(u => !u.EmailConfirmed && u.EmailVerificationTokenExpiresAt < DateTime.UtcNow &&
                            (u.Email == emailNormal || u.NormalizedUsername == usernameNormal))
                .ExecuteDeleteAsync();

            if (await _context.Users.AnyAsync(u => u.Email == emailNormal || u.NormalizedUsername == usernameNormal))
                return BadRequest(new { message = "Bu kullanıcı adı veya e-posta zaten kullanılıyor." });

            var user = new User
            {
                Username = dto.Username.Trim(),
                NormalizedUsername = usernameNormal,
                Email = emailNormal,
                PasswordHash = BCrypt.Net.BCrypt.EnhancedHashPassword(dto.Password),
                AvatarSeed = usernameNormal,
                EmailConfirmed = !RequireEmailVerification,
            };
            var verificationToken = RequireEmailVerification ? IssueVerification(user) : null;
            // Yapılandırmada Owner/Admin olarak adı geçen kişi kayıt olunca rolünü alır
            _current.Promote(user);

            try
            {
                _context.Users.Add(user);
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateException ex) when (ex.InnerException is Npgsql.PostgresException { SqlState: "23505" })
            {
                return BadRequest(new { message = "Bu kullanıcı adı veya e-posta zaten kullanılıyor." });
            }

            if (!RequireEmailVerification)
                return Ok(new { message = "Kayıt başarılı! Artık giriş yapabilirsiniz." });

            try
            {
                await SendVerification(user, verificationToken!);
            }
            catch (Exception)
            {
                return Ok(new { requiresVerification = true, email = user.Email, message = "Kayıt başarılı ama doğrulama e-postası gönderilemedi. Giriş ekranından yeniden isteyebilirsin." });
            }
            return Ok(new { requiresVerification = true, email = user.Email, message = "Kayıt başarılı. E-posta adresine bir doğrulama bağlantısı gönderdik; bağlantıya tıklayınca giriş yapabilirsin." });
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

            if (user.BannedUntil > DateTime.UtcNow)
                return StatusCode(403, new { message = $"Hesabın {user.BannedUntil.Value.ToLocalTime():dd.MM.yyyy HH:mm} tarihine kadar askıya alındı.", bannedUntil = user.BannedUntil });

            if (RequireEmailVerification && !user.EmailConfirmed)
                return StatusCode(403, new { requiresVerification = true, email = user.Email, message = "Devam etmek için e-posta adresini doğrulaman gerekiyor." });

            var previousRole = user.Role;
            _current.Promote(user);
            if (user.Role != previousRole) await _context.SaveChangesAsync();

            var token = GenerateJwtToken(user);
            return Ok(new { token, user = UserDto(user) });
        }

        // GET: api/auth/me
        // İstemci açılışta çağırır: rol ve askı durumu oturum boyunca güncel kalsın.
        [HttpGet("me")]
        [Authorize]
        public async Task<IActionResult> Me()
        {
            var id = CurrentUser.IdOf(User);
            var user = await _context.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == id);
            return user == null ? Unauthorized() : Ok(UserDto(user));
        }

        public class VerifyEmailDto
        {
            public string Email { get; set; } = string.Empty;
            public string Token { get; set; } = string.Empty;
        }

        // POST: api/auth/verify-email
        [HttpPost("verify-email")]
        [EnableRateLimiting("AuthLimiter")]
        public async Task<IActionResult> VerifyEmail(VerifyEmailDto dto)
        {
            var email = dto.Email.Trim().ToLowerInvariant();
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == email);
            if (user == null) return BadRequest(new { message = "Geçersiz bağlantı." });
            if (user.EmailConfirmed) return Ok(new { message = "E-posta adresin zaten doğrulanmış." });

            var stored = user.EmailVerificationToken;
            var valid = stored != null && user.EmailVerificationTokenExpiresAt > DateTime.UtcNow &&
                CryptographicOperations.FixedTimeEquals(Encoding.UTF8.GetBytes(stored), Encoding.UTF8.GetBytes(HashToken(dto.Token ?? string.Empty)));
            if (!valid) return BadRequest(new { message = "Bağlantı geçersiz ya da süresi dolmuş." });

            user.EmailConfirmed = true;
            user.EmailVerificationToken = null;
            user.EmailVerificationTokenExpiresAt = null;
            await _context.SaveChangesAsync();
            return Ok(new { message = "E-posta adresin doğrulandı, giriş yapabilirsin." });
        }

        public class ResendVerificationDto
        {
            public string Email { get; set; } = string.Empty;
        }

        // POST: api/auth/resend-verification
        // Adresin kayıtlı olup olmadığı belli olmasın diye her durumda aynı yanıt verilir.
        [HttpPost("resend-verification")]
        [EnableRateLimiting("AuthLimiter")]
        public async Task<IActionResult> ResendVerification(ResendVerificationDto dto)
        {
            const string reply = "Bu adres kayıtlıysa doğrulama bağlantısı gönderildi.";
            var email = dto.Email.Trim().ToLowerInvariant();
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == email);
            if (user == null || user.EmailConfirmed || !RequireEmailVerification) return Ok(new { message = reply });

            // Birinin gelen kutusunu doldurmak için art arda istenemesin; yanıt yine aynı
            var issuedAt = user.EmailVerificationTokenExpiresAt - VerificationLifetime;
            if (issuedAt > DateTime.UtcNow - ResendCooldown) return Ok(new { message = reply });

            var token = IssueVerification(user);
            await _context.SaveChangesAsync();
            try
            {
                await SendVerification(user, token);
            }
            catch (Exception)
            {
                return StatusCode(502, new { message = "Doğrulama e-postası gönderilemedi, biraz sonra yeniden dene." });
            }
            return Ok(new { message = reply });
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
                new Claim(ClaimTypes.Name, user.Username),
                new Claim(ClaimTypes.Role, user.Role)
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
