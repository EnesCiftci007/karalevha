import { useEffect, useState } from 'react';
import { Box, Download, Eye, File as FileIcon, FileArchive, FileCode, FileText, Film, Image as ImageIcon, Loader2, Music } from 'lucide-react';
import { ObaFile, canPreview, downloadObaFile, fetchObaFile, fileExtension, fileKind, formatSize } from '../../services/files';

interface AttachmentProps {
  messageId: number;
  file: ObaFile;
  uploading?: boolean;
  onOpen: () => void;
}

const THUMBNAIL_LIMIT = 8 * 1024 * 1024; // Bundan büyük görseller sohbet içinde otomatik indirilmez

export function FileTypeIcon({ file, className }: { file: ObaFile; className?: string }) {
  const kind = fileKind(file);
  const ext = fileExtension(file.name);
  if (kind === 'image') return <ImageIcon className={className} />;
  if (kind === 'video') return <Film className={className} />;
  if (kind === 'audio') return <Music className={className} />;
  if (kind === 'model' || ['step', 'stp', 'f3d'].includes(ext)) return <Box className={className} />;
  if (['zip', 'rar', '7z'].includes(ext)) return <FileArchive className={className} />;
  if (kind === 'pdf' || ['doc', 'docx', 'odt', 'rtf', 'txt', 'md'].includes(ext)) return <FileText className={className} />;
  if (kind === 'text') return <FileCode className={className} />;
  return <FileIcon className={className} />;
}

/** Sohbet balonundaki dosya kartı: görsellerde küçük önizleme, diğerlerinde ad + boyut. */
export default function Attachment({ messageId, file, uploading, onOpen }: AttachmentProps) {
  const kind = fileKind(file);
  const showThumb = kind === 'image' && !uploading && file.size <= THUMBNAIL_LIMIT;
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (!showThumb) return;
    let cancelled = false;
    let objectUrl: string | null = null;
    fetchObaFile(messageId)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setThumbUrl(objectUrl);
      })
      .catch(() => {
        /* önizleme alınamazsa dosya kartı zaten görünür */
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [messageId, showThumb]);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await downloadObaFile(messageId, file.name);
    } catch (e) {
      console.error('Dosya indirilemedi:', e);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="w-64 max-w-full bg-levha-yuzey border border-levha-cizgi rounded-lg overflow-hidden text-tebesir">
      {showThumb && (
        // Yükseklik sabit: görsel sonradan gelince sohbet zıplamasın
        <button type="button" onClick={onOpen} className="block w-full h-44 bg-levha-koyu" title="Görüntüle">
          {thumbUrl && <img src={thumbUrl} alt={file.name} className="w-full h-full object-cover" />}
        </button>
      )}
      <div className="flex items-center p-2.5">
        <div className="w-9 h-9 flex-shrink-0 flex items-center justify-center bg-levha text-tebesir-soluk border border-levha-cizgi rounded-md mr-2.5">
          {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileTypeIcon file={file} className="w-4 h-4" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-tebesir truncate" title={file.name}>{file.name}</p>
          <p className="text-xs text-tebesir-silik">
            {uploading ? 'Yükleniyor…' : formatSize(file.size)}
          </p>
        </div>
        {!uploading && (
          <div className="flex items-center ml-2 flex-shrink-0">
            {canPreview(file) && (
              <button type="button" onClick={onOpen} className="p-1.5 text-tebesir-soluk hover:text-isaret" title="Görüntüle" aria-label="Görüntüle">
                <Eye className="w-4 h-4" />
              </button>
            )}
            <button type="button" onClick={handleDownload} disabled={downloading} className="p-1.5 text-tebesir-soluk hover:text-isaret disabled:opacity-50" title="İndir" aria-label="İndir">
              {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
