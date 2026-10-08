using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Karalevha.API.Migrations
{
    /// <inheritdoc />
    public partial class AddUniqueConstraints : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_UserFollows_FollowerId",
                table: "UserFollows");

            migrationBuilder.DropIndex(
                name: "IX_ObaMembers_ObaId",
                table: "ObaMembers");

            migrationBuilder.CreateIndex(
                name: "IX_UserFollows_FollowerId_FollowingId",
                table: "UserFollows",
                columns: new[] { "FollowerId", "FollowingId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ObaMembers_ObaId_UserId",
                table: "ObaMembers",
                columns: new[] { "ObaId", "UserId" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_UserFollows_FollowerId_FollowingId",
                table: "UserFollows");

            migrationBuilder.DropIndex(
                name: "IX_ObaMembers_ObaId_UserId",
                table: "ObaMembers");

            migrationBuilder.CreateIndex(
                name: "IX_UserFollows_FollowerId",
                table: "UserFollows",
                column: "FollowerId");

            migrationBuilder.CreateIndex(
                name: "IX_ObaMembers_ObaId",
                table: "ObaMembers",
                column: "ObaId");
        }
    }
}
