import { Suspense, lazy, useEffect, useState } from 'react';

const CodeViewer = lazy(() => import('../components/kod/CodeViewer'));
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, FolderGit2, Pencil, Trash2 } from 'lucide-react';
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

export default function ProjeDetay() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const social = useSocialCounts('project', id ? [Number(id)] : []);
  const [project, setProject] = useState<Project | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setProject(null);
    setFailed(false);
    api<Project>(`/api/projects/${id}`)
      .then((data) => !cancelled && setProject(data))
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
            <UserLink username={project.owner} className="text-tebesir-soluk" /> ·{' '}
            <time dateTime={project.createdAt} title={fullDate(project.createdAt)}>{timeAgo(project.createdAt)}</time>
          </p>
        </div>
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
      <Suspense fallback={<Skeleton className="h-[calc(100dvh-12rem)] min-h-[480px]" />}>
        <CodeViewer projectId={project.id} />
      </Suspense>

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
          <span className="font-medium text-tebesir">{project.title}</span> KaraLevha'dan kaldırılacak. Depodaki kod etkilenmez.
        </ConfirmDialog>
      )}
    </div>
  );
}
