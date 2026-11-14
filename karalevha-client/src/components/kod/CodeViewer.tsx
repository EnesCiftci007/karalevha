import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Box, Check, ChevronRight, Code2, Copy, Download, ExternalLink, File, FileCode, FileText, Folder, FolderOpen,
  GitBranch, GitFork, Image as ImageIcon, PanelLeft, Search, Star, X,
} from 'lucide-react';
import { api, API_URL } from '../../services/api';
import { formatSize } from '../../services/files';
import { timeAgo } from '../../utils/time';
import { formatOf } from '../../utils/loadModel';
import ModelPreview from '../ModelPreview';
import EmptyState from '../ui/EmptyState';
import Skeleton from '../ui/Skeleton';
import CodeBlock from './CodeBlock';
import Markdown from './Markdown';
import { baseName, findReadme, languageOf, viewKindOf } from './fileTypes';

interface RepoEntry {
  path: string;
  type: 'file' | 'dir';
  size?: number | null;
}

interface RepoInfo {
  provider: 'github' | 'gitlab';
  name: string;
  branch: string;
  description?: string | null;
  stars: number;
  forks: number;
  language?: string | null;
  updatedAt?: string | null;
  webUrl: string;
  truncated: boolean;
  files: RepoEntry[];
}

type FileResult =
  | { kind: 'text'; path: string; size: number; content: string }
  | { kind: 'binary'; path: string; size: number }
  | { kind: 'large'; path: string };

interface TreeNode {
  name: string;
  path: string;
  type: 'file' | 'dir';
  size?: number | null;
  children: TreeNode[];
}

/** Düz yol listesinden iç içe ağaç; klasörler önce, sonra ada göre. */
function buildTree(entries: RepoEntry[]): TreeNode[] {
  const root: TreeNode = { name: '', path: '', type: 'dir', children: [] };
  const dirs = new Map<string, TreeNode>([['', root]]);
  const ensureDir = (path: string): TreeNode => {
    const existing = dirs.get(path);
    if (existing) return existing;
    const parent = ensureDir(path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '');
    const node: TreeNode = { name: baseName(path), path, type: 'dir', children: [] };
    parent.children.push(node);
    dirs.set(path, node);
    return node;
  };
  for (const e of entries) {
    if (e.type === 'dir') ensureDir(e.path);
    else {
      const parent = ensureDir(e.path.includes('/') ? e.path.slice(0, e.path.lastIndexOf('/')) : '');
      parent.children.push({ name: baseName(e.path), path: e.path, type: 'file', size: e.size, children: [] });
    }
  }
  const sort = (n: TreeNode) => {
    n.children.sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name, 'tr', { numeric: true }) : a.type === 'dir' ? -1 : 1));
    n.children.forEach(sort);
  };
  sort(root);
  return root.children;
}

function FileIcon({ path, className }: { path: string; className?: string }) {
  const kind = viewKindOf(path);
  if (kind === 'markdown') return <FileText className={className} aria-hidden="true" />;
  if (kind === 'image') return <ImageIcon className={className} aria-hidden="true" />;
  if (kind === 'model') return <Box className={className} aria-hidden="true" />;
  if (languageOf(path)) return <FileCode className={className} aria-hidden="true" />;
  return <File className={className} aria-hidden="true" />;
}

const parentOf = (path: string) => (path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '');

/* ------------------------------------------------------------------ Dosya ağacı */

function TreeView({
  nodes, depth, open, selected, onToggle, onSelect,
}: {
  nodes: TreeNode[];
  depth: number;
  open: Set<string>;
  selected: string;
  onToggle: (path: string) => void;
  onSelect: (path: string) => void;
}) {
  return (
    <ul role={depth === 0 ? 'tree' : 'group'} aria-label={depth === 0 ? 'Dosyalar' : undefined}>
      {nodes.map((node) => {
        const isOpen = open.has(node.path);
        const isSelected = node.path === selected;
        const pad = { paddingLeft: `${8 + depth * 14}px` };
        return (
          <li key={node.path} role="treeitem" aria-expanded={node.type === 'dir' ? isOpen : undefined} aria-selected={isSelected}>
            <button
              type="button"
              onClick={() => (node.type === 'dir' ? onToggle(node.path) : onSelect(node.path))}
              style={pad}
              className={`w-full flex items-center gap-1.5 h-7 pr-2 text-left text-sm border-l-2 transition-colors ${
                isSelected
                  ? 'border-isaret bg-levha-yuzey text-tebesir'
                  : 'border-transparent text-tebesir-soluk hover:text-tebesir hover:bg-levha-yuzey/60'
              }`}
              title={node.path}
            >
              {node.type === 'dir' ? (
                <>
                  <ChevronRight className={`w-3.5 h-3.5 shrink-0 text-tebesir-silik transition-transform ${isOpen ? 'rotate-90' : ''}`} aria-hidden="true" />
                  {isOpen ? <FolderOpen className="w-4 h-4 shrink-0 text-tebesir-silik" aria-hidden="true" /> : <Folder className="w-4 h-4 shrink-0 text-tebesir-silik" aria-hidden="true" />}
                </>
              ) : (
                <>
                  <span className="w-3.5 shrink-0" />
                  <FileIcon path={node.path} className={`w-4 h-4 shrink-0 ${isSelected ? 'text-isaret' : 'text-tebesir-silik'}`} />
                </>
              )}
              <span className="truncate">{node.name}</span>
            </button>
            {node.type === 'dir' && isOpen && node.children.length > 0 && (
              <TreeView nodes={node.children} depth={depth + 1} open={open} selected={selected} onToggle={onToggle} onSelect={onSelect} />
            )}
          </li>
        );
      })}
    </ul>
  );
}

/* ------------------------------------------------------------------ Görüntüleyici */

export default function CodeViewer({ projectId }: { projectId: number }) {
  const [params, setParams] = useSearchParams();
  const selected = params.get('dosya') ?? '';
  const line = Number(params.get('satir')) || null;

  const [info, setInfo] = useState<RepoInfo | null>(null);
  const [treeError, setTreeError] = useState('');
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState('');
  const [treeVisible, setTreeVisible] = useState(false); // dar ekranda ağaç paneli

  const [file, setFile] = useState<FileResult | null>(null);
  const [fileError, setFileError] = useState('');
  const [modelUrl, setModelUrl] = useState<string | null>(null);
  const [showSource, setShowSource] = useState(false);
  const [copied, setCopied] = useState(false);
  const viewerTop = useRef<HTMLDivElement>(null);

  const rawUrl = useCallback(
    (path: string) => `${API_URL}/api/projects/${projectId}/kod/ham?yol=${encodeURIComponent(path)}`,
    [projectId]
  );

  // Ağaç
  useEffect(() => {
    let cancelled = false;
    setInfo(null);
    setTreeError('');
    api<RepoInfo>(`/api/projects/${projectId}/kod`)
      .then((d) => !cancelled && setInfo(d))
      .catch((e: Error) => !cancelled && setTreeError(e.message));
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const entries = useMemo(() => new Map((info?.files ?? []).map((f) => [f.path, f])), [info]);
  const tree = useMemo(() => buildTree(info?.files ?? []), [info]);
  const filePaths = useMemo(() => (info?.files ?? []).filter((f) => f.type === 'file').map((f) => f.path), [info]);

  // Seçili yol: dosya yoksa klasör; hiçbiri değilse kök
  const selectedEntry = entries.get(selected);
  const currentDir = selectedEntry?.type === 'file' ? parentOf(selected) : selectedEntry?.type === 'dir' ? selected : '';
  const showingFile = selectedEntry?.type === 'file' ? selected : null;
  const dirReadme = !showingFile && info ? findReadme(filePaths, currentDir) : null;
  const target = showingFile ?? dirReadme;

  // Seçili dosyanın üst klasörlerini aç
  useEffect(() => {
    if (!selected) return;
    setOpen((prev) => {
      const next = new Set(prev);
      const parts = selected.split('/');
      for (let i = 1; i <= parts.length; i++) {
        const p = parts.slice(0, i).join('/');
        if (entries.get(p)?.type === 'dir') next.add(p);
      }
      return next;
    });
  }, [selected, entries]);

  // Dosya içeriği
  useEffect(() => {
    setFile(null);
    setFileError('');
    setModelUrl(null);
    setShowSource(false);
    if (!target) return;
    const kind = viewKindOf(target);
    let cancelled = false;
    let objectUrl: string | null = null;

    if (kind === 'image') return;
    if (kind === 'model') {
      fetch(rawUrl(target))
        .then(async (res) => {
          if (!res.ok) throw new Error((await res.json().catch(() => null))?.message ?? 'Model alınamadı.');
          return res.blob();
        })
        .then((blob) => {
          if (cancelled) return;
          objectUrl = URL.createObjectURL(blob);
          setModelUrl(objectUrl);
        })
        .catch((e: Error) => !cancelled && setFileError(e.message));
    } else {
      api<FileResult>(`/api/projects/${projectId}/kod/dosya?yol=${encodeURIComponent(target)}`)
        .then((d) => !cancelled && setFile(d))
        .catch((e: Error) => !cancelled && setFileError(e.message));
    }
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [target, projectId, rawUrl]);

  const select = (path: string) => {
    setParams({ dosya: path }, { replace: false });
    setTreeVisible(false);
    viewerTop.current?.scrollIntoView({ block: 'nearest' });
  };

  const toggle = (path: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });

  const webUrlOf = (path: string, isDir = false) =>
    info
      ? info.provider === 'github'
        ? `${info.webUrl}/${isDir ? 'tree' : 'blob'}/${info.branch}/${path}`
        : `${info.webUrl}/-/${isDir ? 'tree' : 'blob'}/${info.branch}/${path}`
      : '#';

  const copy = async () => {
    if (file?.kind !== 'text') return;
    await navigator.clipboard.writeText(file.content).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  /* ---- Durumlar */

  if (treeError) {
    return <EmptyState icon={Code2} title="Kod gösterilemiyor" description={treeError} />;
  }
  if (!info) {
    return (
      <div className="kart overflow-hidden" role="status" aria-label="Depo yükleniyor">
        <div className="h-12 border-b border-levha-cizgi" />
        <div className="grid lg:grid-cols-[260px_1fr] min-h-[420px]">
          <div className="hidden lg:block border-r border-levha-cizgi p-3 space-y-2">
            {Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-4" />)}
          </div>
          <div className="p-6 space-y-3">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-4 w-full max-w-xl" />
            <Skeleton className="h-4 w-2/3 max-w-lg" />
          </div>
        </div>
      </div>
    );
  }

  const q = filter.trim().toLocaleLowerCase('tr');
  const matches = q ? filePaths.filter((p) => p.toLocaleLowerCase('tr').includes(q)).slice(0, 200) : [];
  const crumbs = (showingFile ?? currentDir).split('/').filter(Boolean);
  const dirChildren = (currentDir === '' ? tree : findNode(tree, currentDir)?.children) ?? [];

  return (
        <section className="kart" aria-label="Kod">
      {/* Depo başlığı */}
      {/* Kutu bilerek overflow-hidden değil: soldaki ağaç yapışkan (sticky) kalabilsin */}
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 border-b border-levha-cizgi bg-levha-yuzey/60 rounded-t-lg">
        <button type="button" onClick={() => setTreeVisible((v) => !v)} className="lg:hidden btn-sade h-8 px-2" aria-expanded={treeVisible} aria-label="Dosya ağacını göster">
          <PanelLeft className="w-4 h-4" />
        </button>
        <span className="font-mono text-sm text-tebesir truncate">{info.name}</span>
        <span className="inline-flex items-center gap-1 veri"><GitBranch className="w-3.5 h-3.5" aria-hidden="true" />{info.branch}</span>
        {info.language && <span className="veri">{info.language}</span>}
        <span className="inline-flex items-center gap-1 veri" title="Yıldız"><Star className="w-3.5 h-3.5" aria-hidden="true" />{info.stars}</span>
        <span className="inline-flex items-center gap-1 veri" title="Çatal"><GitFork className="w-3.5 h-3.5" aria-hidden="true" />{info.forks}</span>
        {info.updatedAt && <span className="veri hidden sm:inline">güncellendi {timeAgo(info.updatedAt)}</span>}
        <a href={info.webUrl} target="_blank" rel="noopener noreferrer" className="ml-auto inline-flex items-center gap-1 text-sm text-tebesir-soluk hover:text-tebesir">
          {info.provider === 'github' ? "GitHub'da aç" : "GitLab'da aç"}
          <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
        </a>
      </header>

      <div className="grid lg:grid-cols-[260px_minmax(0,1fr)]">
        {/* Ağaç */}
        <aside className={`${treeVisible ? 'block' : 'hidden'} lg:block border-b lg:border-b-0 lg:border-r border-levha-cizgi lg:sticky lg:top-16 lg:self-start`} aria-label="Depo dosyaları">
          <div className="p-2 border-b border-levha-cizgi">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-tebesir-silik pointer-events-none" aria-hidden="true" />
              <label htmlFor="kod-dosya-ara" className="sr-only">Dosya ara</label>
              <input id="kod-dosya-ara" type="search" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Dosya ara" className="girdi h-8 pl-8 text-sm" />
            </div>
          </div>
          <div className="max-h-[32rem] lg:max-h-[calc(100vh-9rem)] overflow-y-auto py-1">
            {q ? (
              matches.length === 0 ? (
                <p className="px-3 py-4 text-sm text-tebesir-silik">Eşleşen dosya yok.</p>
              ) : (
                <ul>
                  {matches.map((p) => (
                    <li key={p}>
                      <button
                        type="button"
                        onClick={() => { select(p); setFilter(''); }}
                        className="w-full flex items-center gap-2 h-7 px-3 text-left text-sm text-tebesir-soluk hover:text-tebesir hover:bg-levha-yuzey/60"
                        title={p}
                      >
                        <FileIcon path={p} className="w-4 h-4 shrink-0 text-tebesir-silik" />
                        <span className="truncate"><span className="text-tebesir">{baseName(p)}</span> <span className="text-tebesir-silik text-xs">{parentOf(p)}</span></span>
                      </button>
                    </li>
                  ))}
                </ul>
              )
            ) : (
              <TreeView nodes={tree} depth={0} open={open} selected={selected} onToggle={(p) => { toggle(p); }} onSelect={select} />
            )}
            {info.truncated && <p className="px-3 py-2 text-xs text-tebesir-silik">Depo çok büyük; ağacın bir kısmı gösteriliyor.</p>}
          </div>
        </aside>

        {/* İçerik */}
        <div ref={viewerTop} className="min-w-0 scroll-mt-24">
          {/* Yol ve eylemler */}
          <div className="flex flex-wrap items-center gap-2 px-4 py-1.5 min-h-11 border-b border-levha-cizgi">
            <nav aria-label="Konum" className="flex items-center gap-1 min-w-0 text-sm font-mono">
              <button type="button" onClick={() => setParams({})} className="text-tebesir-soluk hover:text-isaret shrink-0">{info.name.split('/').pop()}</button>
              {crumbs.map((seg, i) => {
                const path = crumbs.slice(0, i + 1).join('/');
                const last = i === crumbs.length - 1;
                return (
                  <span key={path} className="flex items-center gap-1 min-w-0">
                    <span className="text-tebesir-silik">/</span>
                    {last ? (
                      <span className="text-tebesir truncate" aria-current="page">{seg}</span>
                    ) : (
                      <button type="button" onClick={() => select(path)} className="text-tebesir-soluk hover:text-isaret truncate">{seg}</button>
                    )}
                  </span>
                );
              })}
            </nav>
            {showingFile && (
              <div className="ml-auto flex items-center gap-1 shrink-0">
                {file?.kind === 'text' && <span className="veri mr-2 hidden sm:inline">{file.content.split('\n').length} satır · {formatSize(file.size)}</span>}
                {viewKindOf(showingFile) === 'markdown' && file?.kind === 'text' && (
                  <button type="button" onClick={() => setShowSource((v) => !v)} className="btn-sade h-8 px-2 text-xs" aria-pressed={showSource}>
                    {showSource ? 'Önizleme' : 'Kaynak'}
                  </button>
                )}
                {file?.kind === 'text' && (
                  <button type="button" onClick={copy} className="btn-sade h-8 px-2" title="Kopyala" aria-label="Dosya içeriğini kopyala">
                    {copied ? <Check className="w-4 h-4 text-isaret" /> : <Copy className="w-4 h-4" />}
                  </button>
                )}
                <a href={rawUrl(showingFile)} download={baseName(showingFile)} className="btn-sade h-8 px-2" title="İndir" aria-label="Dosyayı indir">
                  <Download className="w-4 h-4" />
                </a>
                <a href={webUrlOf(showingFile)} target="_blank" rel="noopener noreferrer" className="btn-sade h-8 px-2" title="Depoda aç" aria-label="Dosyayı depoda aç">
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            )}
            {!showingFile && filter && (
              <button type="button" onClick={() => setFilter('')} className="ml-auto btn-sade h-8 px-2" aria-label="Aramayı temizle"><X className="w-4 h-4" /></button>
            )}
          </div>

          {/* Klasör içeriği */}
          {/* Geniş ekranda soldaki ağaç aynı listeyi gösterir; README varsa liste yalnızca dar ekranda */}
          {!showingFile && (
            <ul className={`divide-y divide-levha-cizgi border-b border-levha-cizgi ${dirReadme ? 'lg:hidden' : ''}`}>
              {currentDir && (
                <li>
                  <button type="button" onClick={() => (parentOf(currentDir) ? select(parentOf(currentDir)) : setParams({}))} className="w-full flex items-center gap-3 px-4 h-9 text-left text-sm text-tebesir-soluk hover:bg-levha-yuzey/50">
                    <span className="w-4 text-center">..</span>
                  </button>
                </li>
              )}
              {dirChildren.map((n) => (
                <li key={n.path}>
                  <button type="button" onClick={() => select(n.path)} className="w-full flex items-center gap-3 px-4 h-9 text-left text-sm hover:bg-levha-yuzey/50 group">
                    {n.type === 'dir' ? <Folder className="w-4 h-4 shrink-0 text-tebesir-silik" aria-hidden="true" /> : <FileIcon path={n.path} className="w-4 h-4 shrink-0 text-tebesir-silik" />}
                    <span className={`truncate ${n.type === 'dir' ? 'text-tebesir font-medium' : 'text-tebesir-soluk group-hover:text-tebesir'}`}>{n.name}</span>
                    {n.type === 'file' && n.size != null && <span className="ml-auto veri">{formatSize(n.size)}</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}

          {/* Dosya (ya da klasörün README'si) */}
          {target ? (
            <div>
              {!showingFile && (
                <p className="flex items-center gap-2 px-4 pt-4 text-sm font-semibold text-tebesir">
                  <FileText className="w-4 h-4 text-tebesir-silik" aria-hidden="true" />{baseName(target)}
                </p>
              )}
              <FileBody
                path={target}
                file={file}
                error={fileError}
                modelUrl={modelUrl}
                showSource={showSource}
                line={showingFile ? line : null}
                rawUrl={rawUrl}
                exists={(p) => entries.has(p)}
                onOpen={select}
                onLineClick={(n) => setParams({ dosya: target, satir: String(n) }, { replace: true })}
                webUrl={webUrlOf(target)}
              />
            </div>
          ) : (
            !showingFile && dirChildren.length === 0 && <p className="px-4 py-8 text-sm text-tebesir-silik">Bu klasör boş.</p>
          )}
        </div>
      </div>
    </section>
  );
}

function findNode(nodes: TreeNode[], path: string): TreeNode | null {
  for (const n of nodes) {
    if (n.path === path) return n;
    if (n.type === 'dir' && path.startsWith(`${n.path}/`)) return findNode(n.children, path);
  }
  return null;
}

function FileBody({
  path, file, error, modelUrl, showSource, line, rawUrl, exists, onOpen, onLineClick, webUrl,
}: {
  path: string;
  file: FileResult | null;
  error: string;
  modelUrl: string | null;
  showSource: boolean;
  line: number | null;
  rawUrl: (p: string) => string;
  exists: (p: string) => boolean;
  onOpen: (p: string) => void;
  onLineClick: (n: number) => void;
  webUrl: string;
}) {
  const kind = viewKindOf(path);

  if (error) return <p className="px-4 py-8 text-sm text-hata" role="alert">{error}</p>;

  if (kind === 'image') {
    return (
      <div className="p-6 flex justify-center bg-levha-koyu" style={{ backgroundImage: 'repeating-conic-gradient(#1c1c1c 0 25%, #121212 0 50%)', backgroundSize: '16px 16px' }}>
        <img src={rawUrl(path)} alt={baseName(path)} className="max-w-full max-h-[70vh] object-contain" />
      </div>
    );
  }

  if (kind === 'model') {
    return modelUrl ? (
      <div className="h-[60vh] min-h-[320px]">
        <ModelPreview url={modelUrl} format={formatOf(path)!} />
      </div>
    ) : (
      <div className="h-[60vh] min-h-[320px] bg-levha-koyu" role="status" aria-label="Model yükleniyor" />
    );
  }

  if (!file) {
    return (
      <div className="p-4 space-y-2" role="status" aria-label="Dosya yükleniyor">
        {Array.from({ length: 10 }, (_, i) => <Skeleton key={i} className="h-3.5" />)}
      </div>
    );
  }

  if (file.kind !== 'text') {
    return (
      <div className="px-4 py-12 text-center">
        <p className="text-base text-tebesir">{file.kind === 'large' ? 'Bu dosya burada gösterilemeyecek kadar büyük.' : 'Bu dosya metin değil, burada gösterilemiyor.'}</p>
        <div className="mt-4 flex justify-center gap-3">
          <a href={rawUrl(path)} download={baseName(path)} className="btn-ikincil"><Download className="w-4 h-4" />İndir</a>
          <a href={webUrl} target="_blank" rel="noopener noreferrer" className="btn-sade">Depoda aç<ExternalLink className="w-3.5 h-3.5" /></a>
        </div>
      </div>
    );
  }

  if (kind === 'markdown' && !showSource) {
    return (
      <div className="px-6 py-5 max-w-3xl">
        <Markdown source={file.content} path={path} rawUrl={rawUrl} onOpen={onOpen} exists={exists} />
      </div>
    );
  }

  return <CodeBlock code={file.content} language={languageOf(path)} line={line} onLineClick={onLineClick} />;
}
