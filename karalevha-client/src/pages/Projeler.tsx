import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, FolderGit2, GitFork, Plus, Search, Star } from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Project } from '../types';
import { fullDate, timeAgo } from '../utils/time';
import ProjectFormModal from '../components/projeler/ProjectFormModal';
import UserLink from '../components/ui/UserLink';
import PageHeader from '../components/ui/PageHeader';

type SortKey = 'yeni' | 'ad';

/** "https://github.com/kulup/robot" -> "github.com/kulup/robot" */
function repoLabel(url: string): string {
  try {
    const { host, pathname } = new URL(url);
    return (host.replace(/^www\./, '') + pathname).replace(/\/$/, '').replace(/\.git$/, '');
  } catch {
    return url;
  }
}

export default function Projeler() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortKey>('yeni');
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

  const visible = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('tr');
    const list = (projects ?? []).filter(
      (p) =>
        !q ||
        p.title.toLocaleLowerCase('tr').includes(q) ||
        (p.description ?? '').toLocaleLowerCase('tr').includes(q) ||
        p.owner.toLocaleLowerCase('tr').includes(q)
    );
    return [...list].sort((a, b) =>
      sort === 'ad'
        ? a.title.localeCompare(b.title, 'tr')
        : new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [projects, query, sort]);


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

      {/* Arama ve sıralama */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-tebesir-silik pointer-events-none" />
          <label htmlFor="proje-ara" className="sr-only">Projelerde ara</label>
          <input
            id="proje-ara"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Proje, açıklama ya da geliştirici ara"
            className="girdi pl-9"
          />
        </div>
        <label className="sr-only" htmlFor="proje-sirala">Sıralama</label>
        <select id="proje-sirala" value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className="girdi sm:w-44">
          <option value="yeni">En yeni</option>
          <option value="ad">Ada göre (A–Z)</option>
        </select>
      </div>

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
          <p className="veri mb-2">{visible.length} proje</p>
          <ul className="rounded-lg border border-levha-cizgi divide-y divide-levha-cizgi">
            {visible.map((project) => (
              <li key={project.id} className="p-5 flex flex-col sm:flex-row sm:items-start gap-x-6 gap-y-3 hover:bg-levha-yuzey/40 transition-colors">
                <div className="min-w-0 flex-1">
                  <h2 className="flex items-center gap-2 text-base">
                    <FolderGit2 className="w-4 h-4 shrink-0 text-tebesir-silik" strokeWidth={1.75} aria-hidden="true" />
                    <span className="truncate">
                      <UserLink username={project.owner} className="font-normal text-tebesir-soluk" /><span className="text-tebesir-silik"> / </span>
                      <Link to={`/projeler/${project.id}`} className="font-semibold text-tebesir hover:underline underline-offset-4">
                        {project.title}
                      </Link>
                    </span>
                  </h2>
                  {project.description && (
                    <p className="mt-1.5 text-sm leading-relaxed text-tebesir-soluk line-clamp-2 max-w-3xl">{project.description}</p>
                  )}
                  <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-tebesir-silik">
                    <span className="veri truncate max-w-full">{repoLabel(project.repoUrl)}</span>
                    {project.stars > 0 && (
                      <span className="inline-flex items-center gap-1"><Star className="w-3.5 h-3.5" aria-label="Yıldız" />{project.stars}</span>
                    )}
                    {project.forks > 0 && (
                      <span className="inline-flex items-center gap-1"><GitFork className="w-3.5 h-3.5" aria-label="Çatal" />{project.forks}</span>
                    )}
                    <time dateTime={project.createdAt} title={fullDate(project.createdAt)}>{timeAgo(project.createdAt)} eklendi</time>
                  </div>
                </div>
                <a href={project.repoUrl} target="_blank" rel="noopener noreferrer" className="btn-ikincil shrink-0 self-start">
                  Depo
                  <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                </a>
              </li>
            ))}
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
