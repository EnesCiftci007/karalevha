using System.Net.Mail;
using System.Net;

namespace Karalevha.API.Services
{
    public class EmailService : IEmailService
    {
        private readonly IConfiguration _configuration;
        private readonly ILogger<EmailService> _logger;
        private readonly IWebHostEnvironment _env;

        public EmailService(IConfiguration configuration, ILogger<EmailService> logger, IWebHostEnvironment env)
        {
            _configuration = configuration;
            _logger = logger;
            _env = env;
        }

        public async Task SendVerificationEmailAsync(string toEmail, string verificationLink)
        {
            var host = _configuration["Smtp:Host"];
            var portStr = _configuration["Smtp:Port"];
            var user = _configuration["Smtp:User"];
            var pass = _configuration["Smtp:Pass"];

            if (string.IsNullOrEmpty(host) || string.IsNullOrEmpty(user) || string.IsNullOrEmpty(pass))
            {
                if (_env.IsDevelopment())
                {
                    _logger.LogWarning("SMTP Configuration missing. MOCK EMAIL SENT:");
                    _logger.LogWarning($"To: {toEmail}");
                    _logger.LogWarning($"Link: {verificationLink}");
                    return;
                }
                else
                {
                    throw new InvalidOperationException("SMTP Configuration is missing in Production environment.");
                }
            }

            int port = int.TryParse(portStr, out var p) ? p : 587;

            using var client = new SmtpClient(host, port)
            {
                Credentials = new NetworkCredential(user, pass),
                EnableSsl = true
            };

            var mailMessage = new MailMessage
            {
                From = new MailAddress(user, "Karalevha E-Oba"),
                Subject = "Karalevha - E-posta Adresinizi Doğrulayın",
                Body = $"<p>Karalevha'ya hoş geldiniz!</p><p>Hesabınızı doğrulamak için aşağıdaki bağlantıya tıklayın:</p><p><a href=\"{verificationLink}\">E-postamı Doğrula</a></p>",
                IsBodyHtml = true
            };

            mailMessage.To.Add(toEmail);

            try
            {
                await client.SendMailAsync(mailMessage);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to send verification email to {Email}", toEmail);
                throw;
            }
        }
    }
}
