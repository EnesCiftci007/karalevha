import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Code2, ExternalLink, FolderGit2, Pencil, Trash2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import ItemMenu from '../components/ui/ItemMenu';
import UserLink from '../components/ui/UserLink';
import ProjectFormModal from '../components/projeler/ProjectFormModal';
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

  // GitHub depoları github1s ile tarayıcıda VS Code görünümünde açılabilir
  const isGithub = /^https?:\/\/(www\.)?github\.com\//i.test(project.repoUrl);
  const viewerUrl = isGithub ? project.repoUrl.replace(/github\.com/i, 'github1s.com') : '';

  return (
    <div>
      <PageHeader
        title={project.title}
        description={project.description}
        back={back}
        action={
          <div className="flex items-center gap-2">
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

      {isGithub ? (
        <section className="kart overflow-hidden flex flex-col h-[70vh] min-h-[420px]" aria-label="Kod görüntüleyici">
          <div className="h-10 flex items-center gap-2 px-4 border-b border-levha-cizgi bg-levha-yuzey shrink-0">
            <Code2 className="w-4 h-4 text-tebesir-silik" aria-hidden="true" />
            <span className="text-sm text-tebesir-soluk">Kod görüntüleyici</span>
            <span className="ml-auto text-xs text-tebesir-silik">github1s</span>
          </div>
          <iframe src={viewerUrl} title={`${project.title} kodu`} className="w-full flex-1 border-0 bg-levha-koyu" allow="clipboard-read; clipboard-write" />
        </section>
      ) : (
        <EmptyState
          icon={Code2}
          title="Kod önizlemesi yok"
          description="Tarayıcı içi kod görüntüleyici şimdilik yalnızca GitHub depolarını destekliyor."
          action={
            <a href={project.repoUrl} target="_blank" rel="noopener noreferrer" className="btn-ikincil">
              Depoya git
              <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
            </a>
          }
        />
      )}

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
