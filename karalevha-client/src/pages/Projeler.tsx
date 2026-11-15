import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, FolderGit2, Heart, MessageSquare, Plus } from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Project } from '../types';
import { fullDate, timeAgo } from '../utils/time';
import ProjectFormModal from '../components/projeler/ProjectFormModal';
import PageHeader from '../components/ui/PageHeader';
import ListToolbar from '../components/ui/ListToolbar';
import { useMine } from '../components/ui/useMine';
import { useSocialCounts } from '../components/social/Social';

type SortKey = 'yeni' | 'begeni' | 'yorum' | 'ad';

/** "https://github.com/kulup/robot" -> "github.com" */
function repoHost(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, '');
  } catch {
    return 'depo';
  }
}

export default function Projeler() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortKey>('yeni');
  const [mine, setMine] = useMine();
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api<Project[]>('/api/projects')
      .then((data) => !cancelled && setProjects(data))
      .catch(() => {
        if (cancelled) return;
        setProjects([]);
        setLoadFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const social = useSocialCounts('project', (projects ?? []).map((p) => p.id));

  const visible = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('tr');
    const list = (projects ?? []).filter(
      (p) =>
        (!mine || p.owner === user?.username) && (!q ||
        p.title.toLocaleLowerCase('tr').includes(q) ||
        (p.description ?? '').toLocaleLowerCase('tr').includes(q) ||
        p.owner.toLocaleLowerCase('tr').includes(q))
    );
    const newest = (a: Project, b: Project) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    return [...list].sort((a, b) => {
      if (sort === 'ad') return a.title.localeCompare(b.title, 'tr');
      if (sort === 'begeni') return social.get(b.id).likes - social.get(a.id).likes || newest(a, b);
      if (sort === 'yorum') return social.get(b.id).comments - social.get(a.id).comments || newest(a, b);
      return newest(a, b);
    });
  }, [projects, query, sort, social, mine, user]);


  return (
    <div className="pb-16">
      <PageHeader
        title="Projeler"
        description="Kulüpte geliştirilen yazılım ve donanım projeleri. Kodu incele, katkı ver."
        action={
          user ? (
            <button type="button" onClick={() => setShowModal(true)} className="btn-ana">
              <Plus className="w-4 h-4" strokeWidth={2.5} />
              Yeni proje
            </button>
          ) : (
            <Link to="/auth" state={{ from: '/projeler' }} className="btn-ikincil">Proje eklemek için giriş yap</Link>
          )
        }
      />

      <ListToolbar
        id="proje-ara"
        query={query}
        onQuery={setQuery}
        placeholder="Proje, açıklama ya da kişi ara"
        sort={sort}
        onSort={setSort}
        sortOptions={[
          { value: 'yeni', label: 'En yeni' },
          { value: 'begeni', label: 'En çok beğenilen' },
          { value: 'yorum', label: 'En çok yorumlanan' },
          { value: 'ad', label: 'Ada göre (A–Z)' },
        ]}
        count={projects && projects.length > 0 ? { shown: visible.length, total: projects.length, unit: 'proje' } : undefined}
        mine={user ? { active: mine, onChange: setMine } : undefined}
      />

      {/* Liste */}
      {projects === null ? (
        <div className="rounded-lg border border-levha-cizgi divide-y divide-levha-cizgi" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="p-5 space-y-2.5">
              <div className="h-4 w-56 rounded bg-levha-yuzey/60" />
              <div className="h-3 w-full max-w-xl rounded bg-levha-yuzey/60" />
            </div>
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-lg border border-dashed border-levha-cizgi py-14 px-6 text-center">
          <FolderGit2 className="w-8 h-8 mx-auto mb-3 text-tebesir-silik" strokeWidth={1.5} />
          <p className="text-tebesir-soluk">
            {loadFailed
              ? 'Projeler yüklenemedi. Sayfayı yenilemeyi dene.'
              : projects.length === 0
                ? 'Henüz paylaşılmış proje yok.'
                : `"${query.trim()}" için sonuç bulunamadı.`}
          </p>
          {!loadFailed && projects.length === 0 && user && (
            <button type="button" onClick={() => setShowModal(true)} className="btn-ikincil mt-4">İlk projeyi ekle</button>
          )}
        </div>
      ) : (
        <>
          <ul className="kart divide-y divide-levha-cizgi">
            {visible.map((project) => {
              const counts = social.get(project.id);
              return (
                <li key={project.id} className="relative group">
                  <Link to={`/projeler/${project.id}`} className="flex items-start gap-3 px-4 py-3.5 pr-14 hover:bg-levha-yuzey/50 transition-colors">
                    <FolderGit2 className="w-4 h-4 mt-1 shrink-0 text-tebesir-silik group-hover:text-isaret transition-colors" strokeWidth={1.75} aria-hidden="true" />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline gap-x-3 gap-y-0.5 flex-wrap">
                        <span className="text-base font-semibold text-tebesir">{project.title}</span>
                        <span className="text-xs text-tebesir-silik">
                          {project.owner} · <time dateTime={project.createdAt} title={fullDate(project.createdAt)}>{timeAgo(project.createdAt)}</time>
                        </span>
                      </span>
                      {project.description && <span className="block mt-0.5 text-sm text-tebesir-soluk line-clamp-1">{project.description}</span>}
                      <span className="mt-1.5 flex items-center gap-4 text-xs text-tebesir-silik">
                        <span className={`inline-flex items-center gap-1 ${counts.liked ? 'text-isaret' : ''}`} title="Beğeni">
                          <Heart className={`w-3.5 h-3.5 ${counts.liked ? 'fill-isaret' : ''}`} aria-hidden="true" />
                          <span className={`veri ${counts.liked ? "text-isaret" : ""}`}>{counts.likes}</span>
                          <span className="sr-only">beğeni</span>
                        </span>
                        <span className="inline-flex items-center gap-1" title="Yorum">
                          <MessageSquare className="w-3.5 h-3.5" aria-hidden="true" />
                          <span className="veri">{counts.comments}</span>
                          <span className="sr-only">yorum</span>
                        </span>
                        <span className="veri">{repoHost(project.repoUrl)}</span>
                      </span>
                    </span>
                  </Link>
                  <a
                    href={project.repoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="absolute top-3 right-3 p-2 rounded-md text-tebesir-silik hover:text-tebesir hover:bg-levha-yuzey transition-colors"
                    title={`Depoyu aç: ${project.repoUrl}`}
                    aria-label={`${project.title} deposunu yeni sekmede aç`}
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {/* Yeni proje */}
      {showModal && (
        <ProjectFormModal
          onSaved={(created) => setProjects((prev) => [created, ...(prev ?? [])])}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}
