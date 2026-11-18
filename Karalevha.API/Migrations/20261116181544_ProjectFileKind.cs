using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Karalevha.API.Migrations
{
    /// <inheritdoc />
    public partial class ProjectFileKind : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Kind",
                table: "ProjectFiles",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "cizim");

            // Önceden eklenen dosyalar: uzantısına göre elektronik ya da kod bölümüne
            migrationBuilder.Sql(@"
UPDATE ""ProjectFiles"" SET ""Kind"" = 'elektronik'
 WHERE lower(""FileName"") ~ '\.(kicad_sch|kicad_pcb|kicad_pro|kicad_sym|kicad_mod|sch|brd|lbr|schdoc|pcbdoc|prjpcb|fzz|gbr|ger|gtl|gbl|drl)$';
UPDATE ""ProjectFiles"" SET ""Kind"" = 'kod'
 WHERE lower(""FileName"") ~ '\.(ino|c|h|cpp|hpp|py|ipynb|js|ts)$';");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Kind",
                table: "ProjectFiles");
        }
    }
}
