using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Karalevha.API.Migrations
{
    /// <inheritdoc />
    public partial class MarketOrderProject : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "ProjectId",
                table: "MarketOrders",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SourceLabel",
                table: "MarketOrders",
                type: "character varying(300)",
                maxLength: 300,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_MarketOrders_ProjectId",
                table: "MarketOrders",
                column: "ProjectId");

            migrationBuilder.AddForeignKey(
                name: "FK_MarketOrders_Projects_ProjectId",
                table: "MarketOrders",
                column: "ProjectId",
                principalTable: "Projects",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_MarketOrders_Projects_ProjectId",
                table: "MarketOrders");

            migrationBuilder.DropIndex(
                name: "IX_MarketOrders_ProjectId",
                table: "MarketOrders");

            migrationBuilder.DropColumn(
                name: "ProjectId",
                table: "MarketOrders");

            migrationBuilder.DropColumn(
                name: "SourceLabel",
                table: "MarketOrders");
        }
    }
}
