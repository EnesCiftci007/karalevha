import { useEffect, useState, type ReactNode } from 'react';
import { Grid3x3, PanelRightClose, PanelRightOpen, RefreshCw, RotateCcw, Shapes, X } from 'lucide-react';
import ModelPreview, { type ModelStats } from '../ModelPreview';
import type { ViewFormat } from '../../utils/loadModel';

interface ModelViewerPanelProps {
  title: string;
  /** Başlığın altındaki satır (kategori, biçim, yükleyen) */
  meta: ReactNode;
  url: string;
  format: ViewFormat;
  /** Baskı modellerinde ölçüler milimetre kabul edilir */
  unit?: 'mm' | null;
  /** Panelin üstündeki düğmeler (beğeni, indir…) */
  actions: ReactNode;
  /** Açıklama, baskılar, yorumlar */
  children: ReactNode;
  onClose: () => void;
}

const fmt = (n: number) => (n >= 100 ? Math.round(n).toLocaleString('tr-TR') : n.toLocaleString('tr-TR', { maximumFractionDigits: 1 }));

function ToolButton({ label, active, onClick, children }: { label: string; active?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={`p-2 rounded transition-colors ${active ? 'bg-isaret text-levha' : 'text-tebesir-soluk hover:text-tebesir hover:bg-levha-yuzey'}`}
    >
      {children}
    </button>
  );
}

/**
 * Model inceleme ekranı: solda büyük 3B görüntüleyici ve araç çubuğu, sağda bilgi paneli.
 * Telefonda görüntüleyici üstte, panel altta.
 */
export default function ModelViewerPanel({ title, meta, url, format, unit, actions, children, onClose }: ModelViewerPanelProps) {
  const [panelOpen, setPanelOpen] = useState(true);
  const [autoRotate, setAutoRotate] = useState(false);
  const [wireframe, setWireframe] = useState(false);
  const [grid, setGrid] = useState(true);
  const [reset, setReset] = useState(0);
  const [animation, setAnimation] = useState<number | null>(0);
  const [stats, setStats] = useState<ModelStats | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Üstte açık başka bir pencere (düzenle, sil) varsa önce o kapansın
      if (e.key === 'Escape' && document.querySelectorAll('[role="dialog"]').length === 1) onClose();
    };
    window.addEventListener('keydown', onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  // Başka model açılınca ayarlar baştan
  useEffect(() => {
    setStats(null);
    setAnimation(0);
    setWireframe(false);
  }, [url]);

  const d = stats?.dimensions;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 sm:p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="h-full flex flex-col bg-levha border border-levha-cizgi sm:rounded-lg overflow-hidden shadow-2xl">
        {/* Üst çubuk */}
        <header className="flex items-center gap-3 px-4 h-14 border-b border-levha-cizgi shrink-0 bg-levha-yuzey">
          <div className="min-w-0 flex-1">
            <h2 className="font-display font-bold text-base text-tebesir truncate">{title}</h2>
            <div className="text-xs text-tebesir-silik truncate">{meta}</div>
          </div>
          <button
            type="button"
            onClick={() => setPanelOpen((v) => !v)}
            className="hidden lg:inline-flex p-2 rounded text-tebesir-soluk hover:text-tebesir hover:bg-levha"
            aria-label={panelOpen ? 'Paneli gizle' : 'Paneli göster'}
            title={panelOpen ? 'Paneli gizle' : 'Paneli göster'}
          >
            {panelOpen ? <PanelRightClose className="w-5 h-5" /> : <PanelRightOpen className="w-5 h-5" />}
          </button>
          <button type="button" onClick={onClose} className="p-2 -mr-2 rounded text-tebesir-soluk hover:text-tebesir hover:bg-levha" aria-label="Kapat">
            <X className="w-5 h-5" />
          </button>
        </header>

        <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-y-auto lg:overflow-hidden">
          {/* Görüntüleyici */}
          <div className="relative h-[55vh] lg:h-auto lg:flex-1 shrink-0 lg:shrink min-w-0">
            <ModelPreview
              url={url}
              format={format}
              autoRotate={autoRotate}
              wireframe={wireframe}
              grid={grid}
              animation={animation}
              resetSignal={reset}
              onStats={setStats}
              showAnimationLabel={false}
            />

            <div className="absolute top-3 left-3 flex items-center gap-0.5 p-1 rounded-md bg-levha/90 border border-levha-cizgi">
              <ToolButton label="Görünümü sıfırla" onClick={() => setReset((n) => n + 1)}>
                <RotateCcw className="w-4 h-4" />
              </ToolButton>
              <ToolButton label="Kendiliğinden dön" active={autoRotate} onClick={() => setAutoRotate((v) => !v)}>
                <RefreshCw className="w-4 h-4" />
              </ToolButton>
              <ToolButton label="Tel kafes" active={wireframe} onClick={() => setWireframe((v) => !v)}>
                <Shapes className="w-4 h-4" />
              </ToolButton>
              <ToolButton label="Izgara" active={grid} onClick={() => setGrid((v) => !v)}>
                <Grid3x3 className="w-4 h-4" />
              </ToolButton>
            </div>

            {stats && stats.animations.length > 0 && (
              <div className="absolute left-3 bottom-3 flex items-center gap-2 p-1 pl-2 rounded-md bg-levha/90 border border-levha-cizgi">
                <span className="etiket">Animasyon</span>
                <select
                  value={animation ?? -1}
                  onChange={(e) => setAnimation(Number(e.target.value) < 0 ? null : Number(e.target.value))}
                  className="bg-transparent text-sm text-tebesir py-1 pr-1 focus:outline-none max-w-[14rem]"
                  aria-label="Oynatılan animasyon"
                >
                  {stats.animations.map((name, i) => (
                    <option key={i} value={i} className="bg-levha-yuzey">{name}</option>
                  ))}
                  <option value={-1} className="bg-levha-yuzey">Durdur</option>
                </select>
              </div>
            )}

            <p className="hidden sm:block absolute right-3 bottom-3 text-xs text-tebesir-silik pointer-events-none">
              Sol tık: çevir · Sağ tık: kaydır · Tekerlek: yakınlaş
            </p>
          </div>

          {/* Bilgi paneli */}
          {panelOpen && (
            <aside className="lg:w-[400px] shrink-0 border-t lg:border-t-0 lg:border-l border-levha-cizgi bg-levha-yuzey lg:overflow-y-auto">
              <div className="p-5 border-b border-levha-cizgi">{actions}</div>

              <dl className="px-5 py-4 grid grid-cols-2 gap-x-4 gap-y-3 border-b border-levha-cizgi">
                <div className="col-span-2">
                  <dt className="etiket">Ölçüler · en × derinlik × yükseklik{unit && ` (${unit})`}</dt>
                  <dd className="veri text-tebesir mt-0.5">{d ? `${fmt(d.x)} × ${fmt(d.z)} × ${fmt(d.y)}` : '…'}</dd>
                </div>
                <div>
                  <dt className="etiket">Üçgen</dt>
                  <dd className="veri text-tebesir mt-0.5">{stats ? stats.triangles.toLocaleString('tr-TR') : '…'}</dd>
                </div>
                <div>
                  <dt className="etiket">Parça</dt>
                  <dd className="veri text-tebesir mt-0.5">{stats ? stats.meshes : '…'}</dd>
                </div>
                <div>
                  <dt className="etiket">Biçim</dt>
                  <dd className="veri text-tebesir mt-0.5">{format.toUpperCase()}</dd>
                </div>
                <div>
                  <dt className="etiket">Animasyon</dt>
                  <dd className="veri text-tebesir mt-0.5">{stats ? stats.animations.length || 'yok' : '…'}</dd>
                </div>
              </dl>

              {children}
            </aside>
          )}
        </div>
      </div>
    </div>
  );
}
