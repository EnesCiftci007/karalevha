using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Karalevha.API.Migrations
{
    /// <inheritdoc />
    public partial class RemoveVoiceChannels : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Ses kanalları hiç çalışmadı ve kaldırıldı. Yazışma kanalı gibi kullanılmış olabilirler; içindeki
            // mesajlar da silinir (eklenmiş dosyalar diskte kalır). Kanala eklenmiş kişiler kendiliğinden silinir.
            migrationBuilder.Sql(@"DELETE FROM ""ObaMessages"" WHERE ""ChannelId"" IN (SELECT ""Id"" FROM ""ObaChannels"" WHERE ""Type"" <> 'text');");
            migrationBuilder.Sql(@"DELETE FROM ""ObaChannels"" WHERE ""Type"" <> 'text';");

        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Silinen kanallar geri getirilmez.

        }
    }
}
