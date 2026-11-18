using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;

namespace Karalevha.API.Services
{
    public class EmailService : IEmailService
    {
        private readonly HttpClient _httpClient;
        private readonly IConfiguration _configuration;
        private readonly ILogger<EmailService> _logger;
        private readonly IWebHostEnvironment _env;

        public EmailService(HttpClient httpClient, IConfiguration configuration, ILogger<EmailService> logger, IWebHostEnvironment env)
        {
            _httpClient = httpClient;
            _configuration = configuration;
            _logger = logger;
            _env = env;
        }

        public async Task SendVerificationEmailAsync(string toEmail, string verificationLink)
        {
            var apiKey = _configuration["Resend:ApiKey"];
            var fromEmail = _configuration["Resend:FromEmail"] ?? "onboarding@resend.dev";

            if (string.IsNullOrEmpty(apiKey))
            {
                if (_env.IsDevelopment())
                {
                    _logger.LogWarning("Resend API Key missing. MOCK EMAIL SENT:");
                    _logger.LogWarning($"To: {toEmail}");
                    _logger.LogWarning($"Link: {verificationLink}");
                    return;
                }
                else
                {
                    throw new InvalidOperationException("Resend API Key is missing in Production environment.");
                }
            }

            var payload = new
            {
                from = $"KaraLevha <{fromEmail}>",
                to = new[] { toEmail },
                subject = "KaraLevha: e-posta adresini doğrula",
                html = $"<p>Merhaba,</p><p>KaraLevha hesabını açmak için e-posta adresini doğrula:</p>"
                     + $"<p><a href=\"{System.Net.WebUtility.HtmlEncode(verificationLink)}\">E-posta adresimi doğrula</a></p>"
                     + "<p>Bağlantı 24 saat geçerli. Bu kaydı sen yapmadıysan bu e-postayı yok sayabilirsin.</p>",
                text = $"KaraLevha hesabını açmak için e-posta adresini doğrula:\n{verificationLink}\n\n"
                     + "Bağlantı 24 saat geçerli. Bu kaydı sen yapmadıysan bu e-postayı yok sayabilirsin.",
            };

            var json = JsonSerializer.Serialize(payload);
            var content = new StringContent(json, Encoding.UTF8, "application/json");

            try
            {
                var request = new HttpRequestMessage(HttpMethod.Post, "https://api.resend.com/emails")
                {
                    Content = content
                };
                request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);

                var response = await _httpClient.SendAsync(request);
                if (!response.IsSuccessStatusCode)
                {
                    var responseBody = await response.Content.ReadAsStringAsync();
                    _logger.LogError("Failed to send email via Resend. Status: {Status}, Body: {Body}", response.StatusCode, responseBody);
                    throw new Exception("Resend API returned an error.");
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to send verification email to {Email}", toEmail);
                throw;
            }
        }
    }
}
