import { Suspense, lazy, useEffect, useState } from 'react';

const CodeViewer = lazy(() => import('../components/kod/CodeViewer'));
import { useNavigate, useParams } from 'react-router-dom';
import { ExternalLink, FolderGit2, Pencil, Trash2 } from 'lucide-react';
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
        <Skeleton className="h-4 w-20 mb-4" />
        <Skeleton className="h-8 w-72 mb-3" />
        <Skeleton className="h-4 w-full max-w-xl mb-8" />
        <Skeleton className="h-[60vh]" />
      </div>
    );
  }

  const isOwner = user?.username === project.owner;

  return (
    <div>
      <PageHeader
        title={project.title}
        description={project.description}
        back={back}
        action={
          <div className="flex items-center gap-2">
            <LikeButton type="project" id={project.id} counts={social.get(project.id)} onChange={(p) => social.update(project.id, p)} />
            <a href={project.repoUrl} target="_blank" rel="noopener noreferrer" className="btn-ikincil">
              Depoyu aç
              <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
            </a>
            <ItemMenu
              label="Proje seçenekleri"
              actions={[
                ...(isOwner ? [{ label: 'Düzenle', icon: Pencil, onSelect: () => setEditing(true) }] : []),
                ...(isOwner || user?.isAdmin ? [{ label: 'Sil', icon: Trash2, danger: true, onSelect: () => setConfirmDelete(true) }] : []),
              ]}
            />
          </div>
        }
      />

      <p className="-mt-4 mb-8 text-sm text-tebesir-silik">
        <UserLink username={project.owner} className="text-tebesir-soluk" /> ·{' '}
        <time dateTime={project.createdAt} title={fullDate(project.createdAt)}>{timeAgo(project.createdAt)} eklendi</time> ·{' '}
        <span className="veri">{project.repoUrl.replace(/^https?:\/\/(www\.)?/, '')}</span>
      </p>

      {/* Kod: depoyu sitenin kendi görüntüleyicisiyle göster (renklendirme kütüphanesi bu sayfada yüklenir) */}
      <Suspense fallback={<Skeleton className="h-[60vh]" />}>
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
