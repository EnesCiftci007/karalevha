import { API_URL } from './api';

export interface ObaFile {
  name: string;
  size: number;
  contentType: string;
}

export const MAX_FILE_SIZE = 25 * 1024 * 1024; // Backend ile aynı sınır (25 MB)

export type FileKind = 'image' | 'pdf' | 'video' | 'audio' | 'stl' | 'text' | 'other';

const TEXT_EXTENSIONS = new Set([
  'txt', 'md', 'csv', 'json', 'xml', 'yaml', 'yml', 'ino', 'c', 'cpp', 'h', 'hpp',
  'py', 'js', 'ts', 'cs', 'java', 'gcode', 'ipynb',
]);

export function fileExtension(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot === -1 ? '' : name.slice(dot + 1).toLowerCase();
}

/** Dosyanın uygulama içinde nasıl gösterileceğini belirler. */
export function fileKind(file: ObaFile): FileKind {
  const ext = fileExtension(file.name);
  const type = file.contentType || '';
  if (ext === 'stl') return 'stl';
  if (type === 'application/pdf' || ext === 'pdf') return 'pdf';
  if (type.startsWith('image/')) return 'image';
  if (type.startsWith('video/')) return 'video';
  if (type.startsWith('audio/')) return 'audio';
  if (TEXT_EXTENSIONS.has(ext) || type.startsWith('text/')) return 'text';
  return 'other';
}

export const canPreview = (file: ObaFile) => fileKind(file) !== 'other';

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Dosyayı yetki başlığıyla indirir. Gizli obaların dosyaları düz bir <img src> / <a href>
 * ile açılamaz (token gönderilemez), bu yüzden her şey blob üzerinden gider.
 */
export async function fetchObaFile(messageId: number): Promise<Blob> {
  const token = localStorage.getItem('token');
  const res = await fetch(`${API_URL}/api/obamessages/file/${messageId}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (!res.ok) {
    throw new Error(
      res.status === 401 || res.status === 403
        ? 'Bu dosyayı görme yetkiniz yok.'
        : res.status === 404
          ? 'Dosya bulunamadı.'
          : `Dosya alınamadı (${res.status})`
    );
  }
  return res.blob();
}

export async function downloadObaFile(messageId: number, name: string, blob?: Blob): Promise<void> {
  const data = blob ?? (await fetchObaFile(messageId));
  const url = URL.createObjectURL(data);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
