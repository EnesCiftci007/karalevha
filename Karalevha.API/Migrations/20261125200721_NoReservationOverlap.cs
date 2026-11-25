using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Karalevha.API.Migrations
{
    /// <inheritdoc />
    public partial class NoReservationOverlap : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterDatabase()
                .Annotation("Npgsql:PostgresExtension:btree_gist", ",,");

            migrationBuilder.AddCheckConstraint(
                name: "CK_Reservations_EndsAfterStart",
                table: "Reservations",
                sql: "\"EndsAt\" > \"StartsAt\"");

            // Aynı ekipmanın zaman aralıkları kesişemez. '[)' : bitiş dahil değil, 10:00–11:00'den sonra
            // 11:00–12:00 kabul edilir. Mevcut veride çakışma varsa bu komut hata verir ve hiçbir kayıt
            // değişmez (önce scripts/rezervasyon-cakisma-kontrol.sql ile kontrol edin).
            migrationBuilder.Sql("""
                ALTER TABLE "Reservations"
                  ADD CONSTRAINT "EX_Reservations_NoOverlap"
                  EXCLUDE USING gist ("EquipmentId" WITH =, tstzrange("StartsAt", "EndsAt", '[)') WITH &&);
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("ALTER TABLE \"Reservations\" DROP CONSTRAINT IF EXISTS \"EX_Reservations_NoOverlap\";");

            migrationBuilder.DropCheckConstraint(
                name: "CK_Reservations_EndsAfterStart",
                table: "Reservations");
            // btree_gist eklentisi bilerek kaldırılmaz: başka bir şey kullanıyor olabilir, kalması zararsız
        }
    }
}
