namespace Karalevha.API.DTOs
{
    public class PrintModelDto
    {
        public int Id { get; set; }
        public string Title { get; set; } = string.Empty;
        public string? Description { get; set; }
        public string FileName { get; set; } = string.Empty;
        public string FileUrl { get; set; } = string.Empty;
        public DateTime UploadedAt { get; set; }
        public string Uploader { get; set; } = string.Empty;
    }
}
