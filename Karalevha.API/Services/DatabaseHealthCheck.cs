using Karalevha.API.Data;
using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace Karalevha.API.Services
{
    /// <summary>
    /// Hazırlık kontrolü (/health/hazir): API veritabanına ulaşabiliyor mu. /health yalnızca sürecin ayakta
    /// olduğunu söyler; veritabanı kısa süre kesilince platform API'yi gereksiz yere yeniden başlatmasın diye ayrı.
    /// Yanıtta hata ayrıntısı (bağlantı dizesi vb.) gösterilmez.
    /// </summary>
    public class DatabaseHealthCheck(AppDbContext db) : IHealthCheck
    {
        public async Task<HealthCheckResult> CheckHealthAsync(HealthCheckContext context, CancellationToken ct = default)
        {
            try
            {
                return await db.Database.CanConnectAsync(ct)
                    ? HealthCheckResult.Healthy()
                    : HealthCheckResult.Unhealthy("Veritabanına ulaşılamıyor");
            }
            catch (Exception) when (!ct.IsCancellationRequested)
            {
                return HealthCheckResult.Unhealthy("Veritabanına ulaşılamıyor");
            }
        }
    }
}
