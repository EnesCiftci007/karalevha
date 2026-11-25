using Npgsql;

namespace Karalevha.API.Services
{
    /// <summary>
    /// Bu API örneğinin rol önbelleğini güncel tutar: PostgreSQL'de LISTEN ile bekler; herhangi bir örnek bir
    /// kişinin rolünü değiştirince (pg_notify) o kişinin önbelleği silinir ve rol bir sonraki istekte
    /// veritabanından okunur. Bağlantı koparsa önbellek kapatılır (roller her istekte okunur) ve yeniden bağlanılır.
    /// </summary>
    public class RoleChangeListener : BackgroundService
    {
        private readonly CurrentUser _roles;
        private readonly IConfiguration _config;
        private readonly ILogger<RoleChangeListener> _log;

        public RoleChangeListener(CurrentUser roles, IConfiguration config, ILogger<RoleChangeListener> log)
        {
            _roles = roles;
            _config = config;
            _log = log;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            var delay = TimeSpan.FromSeconds(1);
            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    var cs = new NpgsqlConnectionStringBuilder(_config.GetConnectionString("DefaultConnection"))
                    {
                        // Ayrılmış, havuza dönmeyen bağlantı; boşta beklerken kopukluk KeepAlive ile fark edilir
                        Pooling = false,
                        KeepAlive = 30,
                    };
                    await using var conn = new NpgsqlConnection(cs.ConnectionString);
                    await conn.OpenAsync(stoppingToken);
                    conn.Notification += (_, e) =>
                    {
                        if (int.TryParse(e.Payload, out var userId)) _roles.Invalidate(userId);
                        else _roles.ListeningStarted(); // tanınmayan haber: hepsini baştan oku
                    };
                    await using (var cmd = new NpgsqlCommand($"LISTEN {CurrentUser.NotifyChannel}", conn))
                        await cmd.ExecuteNonQueryAsync(stoppingToken);

                    _roles.ListeningStarted();
                    delay = TimeSpan.FromSeconds(1);
                    while (!stoppingToken.IsCancellationRequested)
                        await conn.WaitAsync(stoppingToken);
                }
                catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
                {
                    break;
                }
                catch (Exception e)
                {
                    _log.LogWarning(e, "Rol değişikliği dinlenemiyor; roller her istekte veritabanından okunacak");
                }
                finally
                {
                    _roles.ListeningStopped();
                }

                try { await Task.Delay(delay, stoppingToken); } catch (OperationCanceledException) { break; }
                delay = TimeSpan.FromSeconds(Math.Min(delay.TotalSeconds * 2, 30));
            }
        }
    }
}
