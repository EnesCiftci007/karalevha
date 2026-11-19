using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Karalevha.API.Migrations
{
    /// <inheritdoc />
    public partial class SingleOwner : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateIndex(
                name: "IX_Users_SingleOwner",
                table: "Users",
                column: "Role",
                unique: true,
                filter: "\"Role\" = 'Owner'");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Users_SingleOwner",
                table: "Users");
        }
    }
}
