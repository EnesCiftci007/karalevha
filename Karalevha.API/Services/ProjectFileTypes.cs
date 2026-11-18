namespace Karalevha.API.Services
{
    /// <summary>
    /// Projeye eklenebilen dosyaların türleri, bölüme göre. Tek kaynak burası: istemci de
    /// GET api/projects/dosya-turleri ile bu listeyi alır (yükleme seçicisi ve otomatik sınıflama).
    ///
    /// Görsel, PDF, ZIP ve metin dosyaları her bölüme eklenebilir (şemanın PDF çıktısı, devrenin
    /// fotoğrafı, kod arşivi gibi). 3B modeller ayrı: PrintModelsController.
    /// </summary>
    public static class ProjectFileTypes
    {
        public const string Drawing = "cizim";
        public const string Electronics = "elektronik";
        public const string Code = "kod";
        public static readonly string[] Kinds = { Drawing, Electronics, Code };

        /// <summary>Her bölüme eklenebilenler</summary>
        public static readonly string[] Common =
        {
            ".png", ".jpg", ".jpeg", ".webp", ".gif", ".pdf", ".zip", ".7z", ".txt", ".md", ".csv", ".xlsx",
        };

        /// <summary>Mekanik çizim ve CAD</summary>
        public static readonly string[] DrawingTypes =
        {
            ".dxf", ".dwg", ".svg",                                  // 2B teknik çizim, lazer/CNC kesim
            ".step", ".stp", ".iges", ".igs", ".x_t", ".x_b", ".sat", // tarafsız CAD (her programda açılır)
            ".f3d", ".f3z",                                          // Fusion 360
            ".sldprt", ".sldasm", ".slddrw",                         // SolidWorks
            ".ipt", ".iam", ".idw",                                  // Inventor
            ".fcstd", ".scad", ".3dm", ".skp",                       // FreeCAD, OpenSCAD, Rhino, SketchUp
            ".urdf", ".xacro", ".sdf", ".dae",                       // robot tanımı (ROS, Gazebo)
        };

        /// <summary>Devre şeması, PCB ve üretim dosyaları</summary>
        public static readonly string[] ElectronicsTypes =
        {
            ".kicad_sch", ".kicad_pcb", ".kicad_pro", ".kicad_sym", ".kicad_mod", // KiCad
            ".sch", ".brd", ".lbr",                                                 // Eagle
            ".schdoc", ".pcbdoc", ".prjpcb", ".schlib", ".pcblib",                  // Altium
            ".fzz",                                                                  // Fritzing
            ".pdsprj", ".dsn",                                                       // Proteus
            ".asc", ".cir", ".net", ".sp",                                           // LTspice / SPICE
            ".gbr", ".ger", ".gtl", ".gbl", ".gto", ".gbo", ".gts", ".gbs",          // Gerber katmanları
            ".gtp", ".gbp", ".gko", ".gm1", ".gml", ".drl", ".xln", ".pos",          // kenar, delik, dizgi
            ".json",                                                                  // EasyEDA
        };

        /// <summary>Kaynak kod (depo yoksa ya da depoya ek)</summary>
        public static readonly string[] CodeTypes =
        {
            ".ino", ".c", ".h", ".cpp", ".hpp", ".cc",          // Arduino, gömülü C/C++
            ".py", ".ipynb",                                    // Python, Jupyter
            ".js", ".ts", ".java", ".kt", ".cs", ".rs", ".go", ".lua",
            ".m", ".slx",                                       // MATLAB / Simulink
            ".v", ".sv", ".vhd", ".vhdl",                       // FPGA
            ".asm", ".s",
            ".launch", ".msg", ".srv",                          // ROS
            ".yaml", ".yml", ".toml", ".ini", ".cfg", ".xml", ".json", ".cmake", ".sh",
        };

        public static string[] Of(string kind) => kind switch
        {
            Drawing => DrawingTypes,
            Electronics => ElectronicsTypes,
            Code => CodeTypes,
            _ => Array.Empty<string>(),
        };

        /// <summary>Bu bölüme bu uzantı eklenebilir mi</summary>
        public static bool Allows(string kind, string extension) =>
            Common.Contains(extension, StringComparer.OrdinalIgnoreCase) || Of(kind).Contains(extension, StringComparer.OrdinalIgnoreCase);

        /// <summary>Tarayıcının sitede gösterebildikleri gerçek türüyle, gerisi indirme olarak sunulur</summary>
        public static string ContentTypeOf(string extension) => extension.ToLowerInvariant() switch
        {
            ".png" => "image/png",
            ".jpg" or ".jpeg" => "image/jpeg",
            ".webp" => "image/webp",
            ".gif" => "image/gif",
            ".svg" => "image/svg+xml",
            ".pdf" => "application/pdf",
            ".zip" => "application/zip",
            var e when CodeTypes.Contains(e) || e is ".txt" or ".md" or ".csv" => "text/plain",
            _ => "application/octet-stream",
        };

        /// <summary>Statik sunum için bütün uzantılar (varsayılan tabloda olmayanlar yoksa 404 döner)</summary>
        public static IEnumerable<string> All => Common.Concat(DrawingTypes).Concat(ElectronicsTypes).Concat(CodeTypes).Distinct();
    }
}
