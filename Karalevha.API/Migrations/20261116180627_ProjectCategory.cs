using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Karalevha.API.Migrations
{
    /// <inheritdoc />
    public partial class ProjectCategory : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Category",
                table: "Projects",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "diger");

            // Mevcut projelere içeriğine göre bir dal: yalnızca kod -> yazılım, yalnızca model -> 3B tasarım.
            // Hem kodu hem modeli olanlar "diğer"de kalır; sahibi düzenleyip robotik/elektronik seçer.
            migrationBuilder.Sql(@"
UPDATE ""Projects"" p SET ""Category"" = 'yazilim'
 WHERE p.""RepoUrl"" <> '' AND NOT EXISTS (SELECT 1 FROM ""PrintModels"" m WHERE m.""ProjectId"" = p.""Id"");
UPDATE ""Projects"" p SET ""Category"" = 'tasarim'
 WHERE p.""RepoUrl"" = '' AND EXISTS (SELECT 1 FROM ""PrintModels"" m WHERE m.""ProjectId"" = p.""Id"");");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Category",
                table: "Projects");
        }
    }
}
