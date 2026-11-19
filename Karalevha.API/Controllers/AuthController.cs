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
            // Kayıt hiçbir koşulda rol vermez: yeni hesap her zaman User (rolleri yalnızca Owner dağıtır)

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

            // Bellekteki rolü veritabanındakiyle eşitle (rol vermez, yalnızca okur)
            _current.SetRole(user.Username, user.Role);

            // Jeton yanıt gövdesinde değil, HttpOnly çerezde: JavaScript onu hiç görmez
            AuthCookie.Set(HttpContext, GenerateJwtToken(user));
            return Ok(new { user = UserDto(user) });
        }

        // POST: api/auth/logout   — oturum çerezini siler
        [HttpPost("logout")]
        public IActionResult Logout()
        {
            AuthCookie.Clear(HttpContext);
            return Ok(new { success = true });
        }

        // POST: api/auth/oturum-tasi
        // Eski sürüm jetonu localStorage'da tutuyordu. İstemci o jetonla (Authorization başlığı) bir kez
        // buraya gelir, oturum çereze taşınır ve kişi yeniden giriş yapmak zorunda kalmaz.
        [HttpPost("oturum-tasi")]
        [Authorize]
        public async Task<IActionResult> MoveSessionToCookie()
        {
            var id = CurrentUser.IdOf(User);
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == id);
            if (user == null) return Unauthorized();
            if (user.BannedUntil > DateTime.UtcNow) return StatusCode(403, new { message = "Hesap askıda." });
            AuthCookie.Set(HttpContext, GenerateJwtToken(user));
            return Ok(new { user = UserDto(user) });
        }

        public class DeleteAccountDto
        {
            public string Password { get; set; } = string.Empty;
        }

        // POST: api/auth/hesabi-sil   — hesabı ve kişinin verilerini kalıcı olarak siler (KVKK)
        // Şifre yeniden istenir: açık unutulmuş bir oturumdan hesap silinemesin.
        [HttpPost("hesabi-sil")]
        [Authorize]
        [EnableRateLimiting("AuthLimiter")]
        public async Task<IActionResult> DeleteAccount(DeleteAccountDto dto, [FromServices] AccountDeletion deletion)
        {
            var id = CurrentUser.IdOf(User);
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == id);
            if (user == null) return Unauthorized();
            if (!BCrypt.Net.BCrypt.EnhancedVerify(dto.Password ?? string.Empty, user.PasswordHash))
                return BadRequest(new { message = "Şifre yanlış." });
            if (user.Role == Roles.Owner)
                return BadRequest(new { message = "Kulüp kurucusunun hesabı silinemez. Önce kuruculuğu başka bir yöneticiye devret." });

            await deletion.DeleteAsync(user.Id);
            _current.SetRole(user.Username, Roles.User);
            AuthCookie.Clear(HttpContext);
            return Ok(new { message = "Hesabın ve verilerin silindi." });
        }

        // GET: api/auth/verilerim   — kişinin sitedeki verileri tek bir JSON dosyası olarak (KVKK: bilgi edinme)
        [HttpGet("verilerim")]
        [Authorize]
        [EnableRateLimiting("AuthLimiter")]
        public async Task<IActionResult> ExportMyData()
        {
            var id = CurrentUser.IdOf(User)!.Value;
            var user = await _context.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == id);
            if (user == null) return Unauthorized();
            const int cap = 5000;

            var data = new
            {
                hazirlanma = DateTime.UtcNow,
                hesap = new { user.Id, user.Username, user.Email, user.Role, user.EmailConfirmed, user.BannedUntil },
                projeler = await _context.Projects.AsNoTracking().Where(p => p.UserId == id)
                    .Select(p => new { p.Id, p.Title, p.Description, p.RepoUrl, p.Category, p.CreatedAt }).Take(cap).ToListAsync(),
                ekipUyelikleri = await _context.ProjectMembers.AsNoTracking().Where(m => m.UserId == id)
                    .Select(m => new { m.ProjectId, Proje = m.Project!.Title, m.AddedAt }).Take(cap).ToListAsync(),
                modeller = await _context.PrintModels.AsNoTracking().Where(m => m.UserId == id)
                    .Select(m => new { m.Id, m.Title, m.Description, m.ProjectId, m.UploadedAt, Adres = m.FilePath }).Take(cap).ToListAsync(),
                projeDosyalari = await _context.ProjectFiles.AsNoTracking().Where(f => f.UserId == id)
                    .Select(f => new { f.Id, f.Title, f.FileName, f.ProjectId, f.UploadedAt, Adres = f.FilePath }).Take(cap).ToListAsync(),
                gonderiler = await _context.Posts.AsNoTracking().Where(p => p.UserId == id)
                    .Select(p => new { p.Id, p.Content, p.CreatedAt }).Take(cap).ToListAsync(),
                yorumlar = await _context.Comments.AsNoTracking().Where(c => c.UserId == id)
                    .Select(c => new { c.Id, c.TargetType, c.TargetId, c.Content, c.CreatedAt }).Take(cap).ToListAsync(),
                begeniler = await _context.Likes.AsNoTracking().Where(l => l.UserId == id)
                    .Select(l => new { l.TargetType, l.TargetId }).Take(cap).ToListAsync(),
                obaUyelikleri = await _context.ObaMembers.AsNoTracking().Where(m => m.UserId == id)
                    .Select(m => new { m.ObaId, Oba = m.Oba!.Name, m.JoinedAt }).Take(cap).ToListAsync(),
                kurdugunObalar = await _context.Obalar.AsNoTracking().Where(o => o.OwnerId == id)
                    .Select(o => new { o.Id, o.Name, o.Description, o.CreatedAt }).Take(cap).ToListAsync(),
                obaMesajlari = await _context.ObaMessages.AsNoTracking().Where(m => m.UserId == id)
                    .OrderByDescending(m => m.CreatedAt)
                    .Select(m => new { m.Id, m.ChannelId, m.Content, m.FileName, m.CreatedAt }).Take(cap).ToListAsync(),
                siparisler = await _context.MarketOrders.AsNoTracking().Where(o => o.UserId == id)
                    .Select(o => new { o.Id, o.Service, o.Material, o.Quantity, o.Dimensions, o.Note, o.FileName, o.Status, o.Price, o.CreatedAt }).Take(cap).ToListAsync(),
                rezervasyonlar = await _context.Reservations.AsNoTracking().Where(r => r.UserId == id)
                    .Select(r => new { r.Id, r.EquipmentId, r.StartsAt }).Take(cap).ToListAsync(),
                baskiFotograflari = await _context.PrintMakes.AsNoTracking().Where(m => m.UserId == id)
                    .Select(m => new { m.Id, m.PrintModelId, m.Note, Adres = m.PhotoPath }).Take(cap).ToListAsync(),
                takipEttiklerin = await _context.UserFollows.AsNoTracking().Where(f => f.FollowerId == id)
                    .Select(f => f.Following!.Username).Take(cap).ToListAsync(),
                sikayetlerin = await _context.Reports.AsNoTracking().Where(r => r.ReporterId == id)
                    .Select(r => new { r.TargetType, r.TargetId, r.Reason, r.Note, r.Status, r.CreatedAt }).Take(cap).ToListAsync(),
            };

            var json = System.Text.Json.JsonSerializer.SerializeToUtf8Bytes(data, new System.Text.Json.JsonSerializerOptions(System.Text.Json.JsonSerializerDefaults.Web) { WriteIndented = true });
            return File(json, "application/json", $"karalevha-verilerim-{user.Username}.json");
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
                expires: DateTime.UtcNow.Add(AuthCookie.Lifetime),
                signingCredentials: creds
            );

            return new JwtSecurityTokenHandler().WriteToken(token);
        }
    }
}
