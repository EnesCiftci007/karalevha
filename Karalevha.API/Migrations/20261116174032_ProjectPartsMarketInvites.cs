using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Karalevha.API.Migrations
{
    /// <inheritdoc />
    public partial class ProjectPartsMarketInvites : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "ProjectId",
                table: "PrintModels",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "InviteCode",
                table: "Obalar",
                type: "character varying(32)",
                maxLength: 32,
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsUnlisted",
                table: "Obalar",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.CreateTable(
                name: "MarketOrders",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    UserId = table.Column<int>(type: "integer", nullable: false),
                    Service = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Material = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: false),
                    Quantity = table.Column<int>(type: "integer", nullable: false),
                    Dimensions = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    Note = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    FileName = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    StoredName = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    FileSize = table.Column<long>(type: "bigint", nullable: false),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Price = table.Column<decimal>(type: "numeric(10,2)", nullable: true),
                    StaffNote = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MarketOrders", x => x.Id);
                    table.ForeignKey(
                        name: "FK_MarketOrders_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ProjectFiles",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    ProjectId = table.Column<int>(type: "integer", nullable: false),
                    UserId = table.Column<int>(type: "integer", nullable: false),
                    Title = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    FileName = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    FilePath = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    ContentType = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Size = table.Column<long>(type: "bigint", nullable: false),
                    UploadedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ProjectFiles", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ProjectFiles_Projects_ProjectId",
                        column: x => x.ProjectId,
                        principalTable: "Projects",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ProjectFiles_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_PrintModels_ProjectId",
                table: "PrintModels",
                column: "ProjectId");

            migrationBuilder.CreateIndex(
                name: "IX_Obalar_InviteCode",
                table: "Obalar",
                column: "InviteCode",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_MarketOrders_Status",
                table: "MarketOrders",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_MarketOrders_UserId_CreatedAt",
                table: "MarketOrders",
                columns: new[] { "UserId", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_ProjectFiles_ProjectId",
                table: "ProjectFiles",
                column: "ProjectId");

            migrationBuilder.CreateIndex(
                name: "IX_ProjectFiles_UserId",
                table: "ProjectFiles",
                column: "UserId");

            migrationBuilder.AddForeignKey(
                name: "FK_PrintModels_Projects_ProjectId",
                table: "PrintModels",
                column: "ProjectId",
                principalTable: "Projects",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        
            // 3B modeller artık projelerin içinde: projesi olmayan her model için aynı adla bir proje aç
            // (açıklaması yoksa adı kullanılır, depo adresi boş) ve modeli ona bağla. Hiçbir model kaybolmaz.
            migrationBuilder.Sql(@"
DO $$
DECLARE m RECORD; pid integer;
BEGIN
  FOR m IN SELECT * FROM ""PrintModels"" WHERE ""ProjectId"" IS NULL ORDER BY ""Id"" LOOP
    INSERT INTO ""Projects"" (""Title"", ""Description"", ""RepoUrl"", ""Stars"", ""Forks"", ""CreatedAt"", ""UserId"")
    VALUES (m.""Title"", COALESCE(NULLIF(m.""Description"", ''), m.""Title""), '', 0, 0, m.""UploadedAt"", m.""UserId"")
    RETURNING ""Id"" INTO pid;
    UPDATE ""PrintModels"" SET ""ProjectId"" = pid WHERE ""Id"" = m.""Id"";
  END LOOP;
END $$;");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_PrintModels_Projects_ProjectId",
                table: "PrintModels");

            migrationBuilder.DropTable(
                name: "MarketOrders");

            migrationBuilder.DropTable(
                name: "ProjectFiles");

            migrationBuilder.DropIndex(
                name: "IX_PrintModels_ProjectId",
                table: "PrintModels");

            migrationBuilder.DropIndex(
                name: "IX_Obalar_InviteCode",
                table: "Obalar");

            migrationBuilder.DropColumn(
                name: "ProjectId",
                table: "PrintModels");

            migrationBuilder.DropColumn(
                name: "InviteCode",
                table: "Obalar");

            migrationBuilder.DropColumn(
                name: "IsUnlisted",
                table: "Obalar");
        }
    }
}
