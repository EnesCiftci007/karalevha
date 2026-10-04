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
using System.Data.Common;

namespace Karalevha.API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class AuthController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly IConfiguration _configuration;

        public AuthController(AppDbContext context, IConfiguration configuration)
        {
            _context = context;
            _configuration = configuration;
        }

        [HttpPost("register")]
        [EnableRateLimiting("AuthLimiter")]
        public async Task<IActionResult> Register(RegisterDto dto)
        {
            // Case-insensitive kayıt için normalizasyon
            var emailNormal = dto.Email.ToLowerInvariant();
            var usernameNormal = dto.Username.ToLowerInvariant();

            // SQL'de fonksiyon kullanımını (LOWER) engellemek için doğrudan kıyaslıyoruz.
            // Çünkü C#'da Normalize edilmiş hallerini veritabanına kaydedeceğiz (emailNormal).
            if (await _context.Users.AnyAsync(u => u.Email == emailNormal || u.Username.ToLower() == usernameNormal))
                return BadRequest(new { message = "Bu kullanıcı adı veya e-posta zaten kullanılıyor." });

            var user = new User
            {
                Username = dto.Username, // Gösterim için orijinal
                Email = emailNormal,     // E-posta hep küçük harf tutulur
                PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.Password),
                AvatarSeed = usernameNormal
            };

            try
            {
                _context.Users.Add(user);
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateException) // Race-condition durumunda unique index hatası yakalama
            {
                return BadRequest(new { message = "Bu kullanıcı adı veya e-posta zaten kullanılıyor." });
            }

            return Ok(new { message = "Kayıt başarılı! Artık giriş yapabilirsiniz." });
        }

        [HttpPost("login")]
        [EnableRateLimiting("AuthLimiter")]
        public async Task<IActionResult> Login(LoginDto dto)
        {
            var loginNormal = dto.UsernameOrEmail.ToLowerInvariant();
            
            // Kullanıcı ya e-posta ya da username girmiş olabilir.
            var user = await _context.Users.FirstOrDefaultAsync(u => 
                u.Email == loginNormal || u.Username.ToLower() == loginNormal);

            if (user == null || !BCrypt.Net.BCrypt.Verify(dto.Password, user.PasswordHash))
                return Unauthorized(new { message = "Hatalı kullanıcı adı veya şifre." });

            var token = GenerateJwtToken(user);

            return Ok(new 
            { 
                token, 
                user = new { user.Id, user.Username, user.Email, user.AvatarSeed } 
            });
        }

        private string GenerateJwtToken(User user)
        {
            var jwtKey = _configuration["Jwt:Key"] ?? throw new InvalidOperationException("JWT Key is missing from configuration.");
            var jwtIssuer = _configuration["Jwt:Issuer"] ?? "Karalevha.API";
            var jwtAudience = _configuration["Jwt:Audience"] ?? "Karalevha.Client";

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
