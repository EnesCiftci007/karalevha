namespace Karalevha.API.Services
{
    /// <summary>Herkese açık yüklemeleri (/uploads/...) depodan silme yardımcısı.</summary>
    public static class UploadFiles
    {
        /// <summary>
        /// Kayıt silindikten sonra dosyalarını da kaldırır. Yalnızca /uploads altındaki geçerli yollar;
        /// biri silinemezse (depo geçici olarak yanıt vermiyor) diğerleri yine denenir.
        /// </summary>
        public static async Task DeleteAsync(IFileStore store, IEnumerable<string?> publicPaths, ILogger? log = null)
        {
            foreach (var path in publicPaths)
            {
                if (FileKeys.FromPublicPath(path) is not { } key) continue;
                try
                {
                    await store.DeleteAsync(key);
                }
                catch (Exception e)
                {
                    log?.LogWarning(e, "Dosya silinemedi: {Key}", key);
                }
            }
        }
    }
}
