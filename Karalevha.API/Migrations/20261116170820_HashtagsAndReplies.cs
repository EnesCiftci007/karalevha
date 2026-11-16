using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Karalevha.API.Migrations
{
    /// <inheritdoc />
    public partial class HashtagsAndReplies : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "ParentId",
                table: "Comments",
                type: "integer",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Comments_ParentId",
                table: "Comments",
                column: "ParentId");

            // Etiketler artık metindeki #kelimelerden gelir ve küçük harfle, boşluksuz tutulur:
            // eski sabit etiketleri aynı biçime çevir ("3B Baskı" -> "3bbaskı"). PostgreSQL lower() Türkçe
            // İ/I'yı tam bilmez; eski listede yalnızca "IoT" etkilenir ve "iot" olur, bu da doğru.
            migrationBuilder.Sql(@"UPDATE ""Posts"" SET ""Tags"" = COALESCE((
                SELECT array_agg(DISTINCT t) FROM (
                    SELECT regexp_replace(lower(x), '[^[:alnum:]_]', '', 'g') AS t FROM unnest(""Tags"") AS x
                ) n WHERE length(t) >= 2), '{}') WHERE cardinality(""Tags"") > 0;");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Comments_ParentId",
                table: "Comments");

            migrationBuilder.DropColumn(
                name: "ParentId",
                table: "Comments");
        }
    }
}
