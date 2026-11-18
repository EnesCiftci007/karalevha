import { Suspense, lazy, useCallback, useEffect, useState } from 'react';

const CodeViewer = lazy(() => import('../components/kod/CodeViewer'));
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Box, ChevronLeft, CircuitBoard, Code2, FolderGit2, PenTool, Pencil, Trash2 } from 'lucide-react';
import ProjectModels from '../components/proje/ProjectModels';
import ProjectFiles from '../components/proje/ProjectFiles';
import { categoryOf } from '../utils/projectCategories';
import { useAuth } from '../context/AuthContext';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import ItemMenu from '../components/ui/ItemMenu';
import UserLink from '../components/ui/UserLink';
import ProjectFormModal from '../components/projeler/ProjectFormModal';
import { Comments, LikeButton, useSocialCounts } from '../components/social/Social';
import { api } from '../services/api';
import { Project } from '../types';
import { fullDate, timeAgo } from '../utils/time';
import EmptyState from '../components/ui/EmptyState';
import PageHeader from '../components/ui/PageHeader';
import Skeleton from '../components/ui/Skeleton';

const back = { to: '/projeler', label: 'Projeler' };

type Section = 'kod' | 'modeller' | 'cizimler' | 'elektronik';

export default function ProjeDetay() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const social = useSocialCounts('project', id ? [Number(id)] : []);
  const [project, setProject] = useState<Project | null>(null);
  const [failed, setFailed] = useState(false);
  const [params, setParams] = useSearchParams();
  const [modelCount, setModelCount] = useState<number | null>(null);
  const [drawingCount, setDrawingCount] = useState<number | null>(null);
  const [electronicsCount, setElectronicsCount] = useState<number | null>(null);
  const [codeFileCount, setCodeFileCount] = useState<number | null>(null);
  const onModelCount = useCallback((n: number) => setModelCount(n), []);
  const onDrawingCount = useCallback((n: number) => setDrawingCount(n), []);
  const onElectronicsCount = useCallback((n: number) => setElectronicsCount(n), []);
  const onCodeFileCount = useCallback((n: number) => setCodeFileCount(n), []);

  useEffect(() => {
    let cancelled = false;
    setProject(null);
    setFailed(false);
    api<Project>(`/api/projects/${id}`)
      .then((data) => {
        if (cancelled) return;
        setProject(data);
        setModelCount(data.modelCount ?? null);
        setDrawingCount(data.drawingCount ?? null);
        setElectronicsCount(data.electronicsCount ?? null);
        setCodeFileCount(data.codeFileCount ?? null);
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (failed) {
    return (
      <div>
        <PageHeader title="Proje bulunamadı" back={back} />
        <EmptyState icon={FolderGit2} title="Bu proje yok ya da kaldırılmış" description="Bağlantı eski olabilir. Projeler listesinden bakabilirsin." />
      </div>
    );
  }

  if (!project) {
    return (
      <div role="status" aria-label="Yükleniyor">
        <Skeleton className="h-6 w-72 mb-2" />
        <Skeleton className="h-4 w-96 max-w-full mb-4" />
        <Skeleton className="h-[calc(100dvh-12rem)] min-h-[480px]" />
      </div>
    );
  }

  const isOwner = user?.username === project.owner;
  const hasCode = !!project.repoUrl;
  const models = modelCount ?? project.modelCount ?? 0;
  const drawings = drawingCount ?? project.drawingCount ?? 0;
  const electronics = electronicsCount ?? project.electronicsCount ?? 0;
  const codeFiles = codeFileCount ?? project.codeFileCount ?? 0;

  // Bölümler: proje sahibi hepsini görür (boşsa ekler); ziyaretçi yalnızca içi dolu olanları
  const all: { id: Section; label: string; icon: typeof Code2; count?: number; has: boolean }[] = [
    { id: 'kod', label: 'Kod', icon: Code2, count: hasCode ? undefined : codeFiles, has: hasCode || codeFiles > 0 },
    { id: 'modeller', label: 'Modeller', icon: Box, count: models, has: models > 0 },
    { id: 'cizimler', label: 'Çizimler', icon: PenTool, count: drawings, has: drawings > 0 },
    { id: 'elektronik', label: 'Elektronik', icon: CircuitBoard, count: electronics, has: electronics > 0 },
  ];
  const shown = all.filter((t) => isOwner || t.has);
  const tabs = shown.length > 0 ? shown : all.filter((t) => t.id === 'modeller');

  // Bölüm: adresteki ?bolum, yoksa içi dolu ilk bölüm (kod > modeller > çizimler > elektronik)
  const asked = params.get('bolum') as Section | null;
  const fallback: Section = params.has('model') ? 'modeller' : (all.find((t) => t.has) ?? tabs[0]).id;
  const section: Section = asked && tabs.some((t) => t.id === asked) ? asked : fallback;
  const go = (id: Section) =>
    setParams((p) => {
      const next = new URLSearchParams(p);
      next.set('bolum', id);
      if (id !== 'modeller') next.delete('model');
      return next;
    }, { replace: true });

  return (
    <div>
      {/* Sıkı başlık: kod görüntüleyici ilk ekranda tam görünsün */}
      <header className="flex items-center gap-x-4 h-8 mb-2">
        <div className="min-w-0 flex-1 flex items-baseline gap-2">
          <Link to={back.to} className="shrink-0 self-center inline-flex items-center gap-0.5 text-sm text-tebesir-silik hover:text-tebesir" aria-label="Projelere dön">
            <ChevronLeft className="w-4 h-4" aria-hidden="true" />
            <span className="hidden sm:inline">{back.label}</span>
          </Link>
          <span className="text-tebesir-silik" aria-hidden="true">/</span>
          <h1 className="shrink-0 max-w-[50%] font-display font-bold text-lg text-tebesir truncate" title={project.title}>{project.title}</h1>
          <p className="min-w-0 truncate text-sm text-tebesir-silik">
            {project.description && project.description.trim() !== project.title && (
              <><span className="text-tebesir-soluk" title={project.description}>{project.description.trim()}</span> · </>
            )}
            <Link to={`/projeler?dal=${categoryOf(project.category).id}`} className="hover:text-tebesir">{categoryOf(project.category).label}</Link> ·{' '}
            <UserLink username={project.owner} className="text-tebesir-soluk" /> ·{' '}
            <time dateTime={project.createdAt} title={fullDate(project.createdAt)}>{timeAgo(project.createdAt)}</time>
          </p>
        </div>
        {/* Projenin parçaları */}
        <nav className="flex items-center gap-0.5 shrink-0 rounded-md border border-levha-cizgi p-0.5" aria-label="Proje bölümleri">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => go(t.id)}
              aria-current={section === t.id ? 'page' : undefined}
              className={`inline-flex items-center gap-1.5 h-6 px-2 rounded text-xs font-medium transition-colors ${section === t.id ? 'bg-levha-yuzey text-tebesir' : 'text-tebesir-silik hover:text-tebesir'}`}
            >
              <t.icon className="w-3.5 h-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">{t.label}</span>
              {t.count !== undefined && <span className={`veri ${section === t.id ? 'text-isaret' : ''}`}>{t.count}</span>}
            </button>
          ))}
        </nav>
        <div className="flex items-center gap-1 shrink-0">
          <LikeButton type="project" id={project.id} counts={social.get(project.id)} onChange={(p) => social.update(project.id, p)} />
          <ItemMenu
            label="Proje seçenekleri"
            actions={[
              ...(isOwner ? [{ label: 'Düzenle', icon: Pencil, onSelect: () => setEditing(true) }] : []),
              ...(isOwner || user?.isAdmin ? [{ label: 'Sil', icon: Trash2, danger: true, onSelect: () => setConfirmDelete(true) }] : []),
            ]}
          />
        </div>
      </header>

      {/* Kod: depoyu sitenin kendi görüntüleyicisiyle göster (renklendirme kütüphanesi bu sayfada yüklenir) */}
      {section === 'kod' && hasCode && (
        <Suspense fallback={<Skeleton className="h-[calc(100dvh-12rem)] min-h-[480px]" />}>
          <CodeViewer projectId={project.id} />
        </Suspense>
      )}
      {/* Depoya ek ya da depo yerine yüklenen kod dosyaları (Arduino çizimi, Python betiği…) */}
      <div className={section === 'kod' && (!hasCode || codeFiles > 0 || isOwner) ? (hasCode ? 'mt-8' : 'mt-4') : 'hidden'}>
        {hasCode && <h2 className="etiket mb-3">Yüklenen kod dosyaları</h2>}
        <ProjectFiles projectId={project.id} kind="kod" canEdit={isOwner} canDelete={isOwner || !!user?.isAdmin} onCountChange={onCodeFileCount} />
      </div>
      {/* Sayılar sekme açılmadan da güncel kalsın diye iki bölüm de bağlı; görünmeyen gizlenir */}
      <div className={section === 'modeller' ? 'mt-4' : 'hidden'}>
        <ProjectModels projectId={project.id} canEdit={isOwner} onCountChange={onModelCount} />
      </div>
      <div className={section === 'cizimler' ? 'mt-4' : 'hidden'}>
        <ProjectFiles projectId={project.id} kind="cizim" canEdit={isOwner} canDelete={isOwner || !!user?.isAdmin} onCountChange={onDrawingCount} />
      </div>
      <div className={section === 'elektronik' ? 'mt-4' : 'hidden'}>
        <ProjectFiles projectId={project.id} kind="elektronik" canEdit={isOwner} canDelete={isOwner || !!user?.isAdmin} onCountChange={onElectronicsCount} />
      </div>

      <section className="mt-12 max-w-okuma">
        <h2 className="font-display font-semibold text-lg text-tebesir mb-4">
          Yorumlar <span className="veri text-base">{social.get(project.id).comments}</span>
        </h2>
        <Comments type="project" id={project.id} onCountChange={(n) => social.update(project.id, { comments: n })} />
      </section>

      {editing && <ProjectFormModal project={project} onSaved={setProject} onClose={() => setEditing(false)} />}
      {confirmDelete && (
        <ConfirmDialog
          title="Proje silinsin mi?"
          confirmLabel="Projeyi sil"
          onClose={() => setConfirmDelete(false)}
          onConfirm={async () => {
            await api(`/api/projects/${project.id}`, { method: 'DELETE' });
            navigate('/projeler', { replace: true });
          }}
        >
          <span className="font-medium text-tebesir">{project.title}</span> KaraLevha'dan modelleri ve çizimleriyle birlikte kaldırılacak. Depodaki kod etkilenmez.
        </ConfirmDialog>
      )}
    </div>
  );
}
