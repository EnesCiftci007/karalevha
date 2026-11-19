using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Karalevha.API.Models
{
    /// <summary>
    /// Market siparişi: kulübün atölyesinden CNC, lazer, 3B baskı ya da PCB üretim talebi.
    /// Demo: ödeme alınmaz; fiyatı ve durumu kulüp yöneticileri girer.
    /// </summary>
    public class MarketOrder
    {
        [Key]
        public int Id { get; set; }

        public int UserId { get; set; }
        [ForeignKey("UserId")]
        public User? User { get; set; }

        /// <summary>MarketCatalog'daki hizmet kimliği: "cnc", "lazer", "baski", "pcb"</summary>
        [Required]
        [MaxLength(20)]
        public string Service { get; set; } = string.Empty;

        [Required]
        [MaxLength(60)]
        public string Material { get; set; } = string.Empty;

        public int Quantity { get; set; } = 1;

        /// <summary>İsteğe bağlı ölçü bilgisi (ör. "120 x 80 x 3 mm")</summary>
        [MaxLength(100)]
        public string? Dimensions { get; set; }

        [MaxLength(1000)]
        public string? Note { get; set; }

        /// <summary>Tasarım dosyasının özgün adı ve wwwroot dışındaki saklama adı</summary>
        [Required]
        [MaxLength(255)]
        public string FileName { get; set; } = string.Empty;
        [Required]
        [MaxLength(100)]
        public string StoredName { get; set; } = string.Empty;
        public long FileSize { get; set; }

        /// <summary>Sipariş bir projenin modelinden ya da dosyasından verildiyse o proje (silinirse boşalır)</summary>
        public int? ProjectId { get; set; }
        [ForeignKey("ProjectId")]
        public Project? Project { get; set; }

        /// <summary>Kaynağın o anki adı, ör. "Robot kol · govde.step"; proje silinse de sipariş geçmişinde kalır</summary>
        [MaxLength(300)]
        public string? SourceLabel { get; set; }

        /// <summary>alindi → fiyatlandi → onaylandi → uretimde → hazir → teslim; ya da iptal</summary>
        [Required]
        [MaxLength(20)]
        public string Status { get; set; } = MarketStatus.Received;

        /// <summary>Yöneticinin verdiği fiyat (TL). Demo: bilgi amaçlı, ödeme alınmaz.</summary>
        [Column(TypeName = "numeric(10,2)")]
        public decimal? Price { get; set; }

        /// <summary>Yöneticinin sipariş sahibine notu (ör. teslim zamanı, malzeme önerisi)</summary>
        [MaxLength(1000)]
        public string? StaffNote { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    }

    public static class MarketStatus
    {
        public const string Received = "alindi";
        public const string Quoted = "fiyatlandi";
        public const string Approved = "onaylandi";
        public const string InProduction = "uretimde";
        public const string Ready = "hazir";
        public const string Delivered = "teslim";
        public const string Cancelled = "iptal";

        public static readonly string[] All = { Received, Quoted, Approved, InProduction, Ready, Delivered, Cancelled };

        public static string Label(string status) => status switch
        {
            Received => "alındı",
            Quoted => "fiyat verildi",
            Approved => "onaylandı",
            InProduction => "üretimde",
            Ready => "teslime hazır",
            Delivered => "teslim edildi",
            Cancelled => "iptal edildi",
            _ => status,
        };
    }

    /// <summary>Market hizmetleri. Demo için kodda sabit; ileride yöneticiler düzenleyebilir.</summary>
    public static class MarketCatalog
    {
        public record ServiceDef(string Id, string Name, string Description, string[] Materials, string[] Extensions, string Hint);

        public static readonly ServiceDef[] Services =
        {
            new("cnc", "CNC freze",
                "Ahşap, plastik ve yumuşak metalden 2.5B parça, gövde ve kalıp kesimi.",
                new[] { "MDF", "Kontrplak", "Masif ahşap", "Akrilik (pleksi)", "Alüminyum", "POM (delrin)" },
                new[] { ".dxf", ".svg", ".step", ".stp", ".stl", ".f3d", ".zip" },
                "DXF ya da STEP gönder; ölçüleri ve kalınlığı nota yaz."),
            new("lazer", "Lazer kesim ve kazıma",
                "İnce levhalardan hızlı kesim; panel, kutu, levha ve kazıma işleri.",
                new[] { "Kontrplak 3 mm", "MDF 3 mm", "Akrilik 3 mm", "Akrilik 5 mm", "Karton", "Deri" },
                new[] { ".dxf", ".svg", ".pdf", ".png", ".jpg", ".jpeg", ".zip" },
                "Kesim çizgileri vektör (DXF/SVG/PDF) olmalı; kazıma için görsel de olur."),
            new("baski", "3B baskı",
                "FDM yazıcılarla prototip ve son kullanım parçası.",
                new[] { "PLA", "PETG", "ABS", "TPU (esnek)" },
                new[] { ".stl", ".3mf", ".obj", ".step", ".stp", ".zip" },
                "Doluluk ve renk tercihini nota yaz."),
            new("pcb", "Devre kartı (PCB)",
                "Tek ya da çift katlı kart üretimi ve isteğe bağlı lehimleme.",
                new[] { "FR4 tek katlı", "FR4 çift katlı" },
                new[] { ".zip", ".gbr", ".kicad_pcb", ".brd" },
                "Gerber dosyalarını ZIP olarak gönder."),
        };

        public static ServiceDef? Find(string id) => Services.FirstOrDefault(s => s.Id == id);
    }
}
