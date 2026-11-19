import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

/** "docs/kurulum.md" içindeki "../img/a.png" -> "img/a.png". Depo dışına çıkan yollar null. */
export function resolvePath(fromFile: string, target: string): string | null {
  const clean = target.split('#')[0].split('?')[0];
  if (!clean) return null;
  const parts = clean.startsWith('/') ? [] : fromFile.split('/').slice(0, -1);
  for (const seg of clean.replace(/^\//, '').split('/')) {
    if (seg === '' || seg === '.') continue;
    if (seg === '..') {
      if (parts.length === 0) return null;
      parts.pop();
    } else {
      try {
        parts.push(decodeURIComponent(seg));
      } catch {
        parts.push(seg);
      }
    }
  }
  return parts.join('/');
}

const isExternal = (href: string) => /^(https?:)?\/\//i.test(href) || /^mailto:/i.test(href);

interface MarkdownProps {
  source: string;
  /** Markdown dosyasının depodaki yolu (göreli bağlantılar için) */
  path: string;
  /** Depodaki bir dosyanın ham adresi (görseller için) */
  rawUrl: (path: string) => string;
  /** Depodaki bir dosyayı görüntüleyicide aç */
  onOpen: (path: string) => void;
  /** Depoda var mı? */
  exists: (path: string) => boolean;
}

/** README ve diğer .md dosyaları. Ham HTML çalıştırılmaz (react-markdown varsayılanı). */
export default function Markdown({ source, path, rawUrl, onOpen, exists }: MarkdownProps) {
  return (
    <div className="md-icerik">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href = '', children }) => {
            if (href.startsWith('#')) return <a href={href}>{children}</a>;
            if (isExternal(href)) return <a href={href} target="_blank" rel="noopener noreferrer nofollow">{children}</a>;
            const target = resolvePath(path, href);
            if (target && exists(target)) {
              return (
                <a href={`?dosya=${encodeURIComponent(target)}`} onClick={(e) => { e.preventDefault(); onOpen(target); }}>
                  {children}
                </a>
              );
            }
            return <span>{children}</span>;
          },
          img: ({ src = '', alt = '' }) => {
            const url = typeof src === 'string' ? src : '';
            if (isExternal(url)) return <img src={url} alt={alt} loading="lazy" referrerPolicy="no-referrer" />;
            const target = resolvePath(path, url);
            return target && exists(target) ? <img src={rawUrl(target)} alt={alt} loading="lazy" /> : null;
          },
        }}
      >
        {source}
      </ReactMarkdown>
    </div>
  );
}
