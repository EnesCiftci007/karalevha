using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Karalevha.API.Migrations
{
    /// <inheritdoc />
    public partial class PrivateChannels : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "CreatedById",
                table: "ObaChannels",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsPrivate",
                table: "ObaChannels",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.CreateTable(
                name: "ObaChannelMembers",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    ChannelId = table.Column<int>(type: "integer", nullable: false),
                    UserId = table.Column<int>(type: "integer", nullable: false),
                    AddedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ObaChannelMembers", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ObaChannelMembers_ObaChannels_ChannelId",
                        column: x => x.ChannelId,
                        principalTable: "ObaChannels",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ObaChannelMembers_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ObaChannelMembers_ChannelId_UserId",
                table: "ObaChannelMembers",
                columns: new[] { "ChannelId", "UserId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ObaChannelMembers_UserId",
                table: "ObaChannelMembers",
                column: "UserId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ObaChannelMembers");

            migrationBuilder.DropColumn(
                name: "CreatedById",
                table: "ObaChannels");

            migrationBuilder.DropColumn(
                name: "IsPrivate",
                table: "ObaChannels");
        }
    }
}
