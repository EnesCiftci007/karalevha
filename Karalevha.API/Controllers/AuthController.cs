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
            var emailNormal = dto.Email.ToLowerInvariant();
            var usernameNormal = dto.Username.ToLowerInvariant();

            if (await _context.Users.AnyAsync(u => u.Email == emailNormal || u.NormalizedUsername == usernameNormal))
                return BadRequest(new { message = "Bu kullanıcı adı veya e-posta zaten kullanılıyor." });

            var user = new User
            {
                Username = dto.Username,
                NormalizedUsername = usernameNormal,
                Email = emailNormal,
                PasswordHash = BCrypt.Net.BCrypt.EnhancedHashPassword(dto.Password),
                AvatarSeed = usernameNormal
            };

            try
            {
                _context.Users.Add(user);
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateException ex) when (ex.InnerException is Npgsql.PostgresException { SqlState: "23505" })
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
            
            var user = await _context.Users.FirstOrDefaultAsync(u => 
                u.Email == loginNormal || u.NormalizedUsername == loginNormal);

            if (user == null || !BCrypt.Net.BCrypt.EnhancedVerify(dto.Password, user.PasswordHash))
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
