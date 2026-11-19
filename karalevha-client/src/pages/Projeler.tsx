import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Box, CircuitBoard, Code2, FolderGit2, Heart, MessageSquare, PenTool, Plus } from 'lucide-react';
import { api, API_URL } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Project } from '../types';
import { fullDate, timeAgo } from '../utils/time';
import ProjectFormModal from '../components/projeler/ProjectFormModal';
import PageHeader from '../components/ui/PageHeader';
import ListToolbar from '../components/ui/ListToolbar';
import { useMine } from '../components/ui/useMine';
import { useSocialCounts } from '../components/social/Social';
import ModelThumbnail from '../components/proje/ModelThumbnail';
import { formatOf } from '../utils/loadModel';
import { PROJECT_CATEGORIES, categoryOf } from '../utils/projectCategories';

type SortKey = 'yeni' | 'begeni' | 'yorum' | 'ad';

/** "https://github.com/kulup/robot" -> "github.com" */
function repoHost(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, '');
  } catch {
    return 'depo';
  }
}

/** "https://github.com/kulup/robot" -> "kulup/robot" */
function repoPath(url: string): string {
  try {
    return new URL(url).pathname.replace(/^\/|\.git$|\/$/g, '') || url;
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
  const [mine, setMine] = useMine();
  // Dal süzgeci adreste (?dal=robotik), paylaşılabilsin
  const [params, setParams] = useSearchParams();
  const dal = PROJECT_CATEGORIES.some((c) => c.id === params.get('dal')) ? params.get('dal') : null;
  const setDal = (id: string | null) =>
    setParams((p) => {
      const n = new URLSearchParams(p);
      if (id) n.set('dal', id);
      else n.delete('dal');
      return n;
    }, { replace: true });
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
        (!mine || p.owner === user?.username || (!!user && !!p.memberIds?.includes(user.id))) && (!dal || categoryOf(p.category).id === dal) && (!q ||
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
  }, [projects, query, sort, social, mine, user, dal]);
  const countOf = (id: string) => (projects ?? []).filter((p) => categoryOf(p.category).id === id).length;


  return (
    <div className="pb-16">
      <PageHeader
        title="Projeler"
        description="Kulüpte geliştirilen projeler: kodu, 3B modelleri ve çizimleri bir arada."
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

      {/* Dallar */}
      <nav className="flex flex-wrap items-center gap-2 mb-5" aria-label="Proje dalları">
        {[{ id: null as string | null, label: 'Tümü', count: projects?.length }, ...PROJECT_CATEGORIES.map((c) => ({ id: c.id as string | null, label: c.label, count: countOf(c.id), icon: c.icon }))].map((c) => {
          const active = dal === c.id;
          const Icon = 'icon' in c ? c.icon : null;
          return (
            <button
              key={c.id ?? 'hepsi'}
              type="button"
              onClick={() => setDal(c.id)}
              aria-pressed={active}
              className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-md border text-sm transition-colors ${active ? 'border-isaret/60 bg-isaret/10 text-tebesir' : 'border-levha-cizgi text-tebesir-soluk hover:border-tebesir-silik hover:text-tebesir'}`}
            >
              {Icon && <Icon className="w-4 h-4" aria-hidden="true" />}
              {c.label}
              {c.count !== undefined && <span className={`veri ${active ? 'text-isaret' : ''}`}>{c.count}</span>}
            </button>
          );
        })}
      </nav>

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
                : query.trim()
                  ? `"${query.trim()}" için sonuç bulunamadı.`
                  : 'Bu dalda henüz proje yok.'}
          </p>
          {!loadFailed && projects.length === 0 && user && (
            <button type="button" onClick={() => setShowModal(true)} className="btn-ikincil mt-4">İlk projeyi ekle</button>
          )}
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((project) => {
            const counts = social.get(project.id);
            const dal = categoryOf(project.category);
            const coverFormat = project.cover ? formatOf(project.cover.fileName) : null;
            return (
              <li key={project.id}>
                <Link to={`/projeler/${project.id}`} className="kart group flex flex-col h-full overflow-hidden hover:border-tebesir-silik transition-colors">
                  {/* Önizleme: modeli varsa modelin küçük resmi, yalnızca kodsa depo */}
                  {project.cover && coverFormat ? (
                    <ModelThumbnail url={`${API_URL}${project.cover.fileUrl}`} format={coverFormat} />
                  ) : (
                    <div className="relative aspect-[4/3] bg-levha-koyu overflow-hidden">
                      <div className="kareli absolute inset-0" aria-hidden="true" />
                      <div className="relative h-full flex flex-col justify-center gap-2 px-6 font-mono text-xs text-tebesir-silik">
                        <Code2 className="w-6 h-6 mb-1 text-levha-cizgi group-hover:text-isaret transition-colors" strokeWidth={1.5} aria-hidden="true" />
                        {project.repoUrl ? (
                          <>
                            <span className="text-tebesir-soluk truncate">{repoPath(project.repoUrl)}</span>
                            <span>{repoHost(project.repoUrl)}</span>
                          </>
                        ) : (
                          <span>henüz kod, model ya da çizim yok</span>
                        )}
                      </div>
                    </div>
                  )}
                  <div className="flex-1 flex flex-col px-4 py-3 border-t border-levha-cizgi">
                    <span className="flex items-center gap-2">
                      <span className="flex-1 min-w-0 font-semibold text-tebesir truncate group-hover:text-isaret transition-colors">{project.title}</span>
                      <span className="inline-flex items-center gap-1 shrink-0 text-xs text-tebesir-silik" title={`Dal: ${dal.label}`}>
                        <dal.icon className="w-3.5 h-3.5" aria-hidden="true" />{dal.label}
                      </span>
                    </span>
                    {project.description && project.description.trim() !== project.title && (
                      <span className="mt-0.5 text-sm text-tebesir-soluk line-clamp-2">{project.description}</span>
                    )}
                    <span className="mt-auto pt-3 flex items-center gap-3 text-xs text-tebesir-silik">
                      <span className="min-w-0 truncate">
                        {project.owner} · <time dateTime={project.createdAt} title={fullDate(project.createdAt)}>{timeAgo(project.createdAt)}</time>
                      </span>
                      <span className="ml-auto flex items-center gap-3 shrink-0">
                        {/* Projenin parçaları */}
                        {(project.repoUrl || !!project.codeFileCount) && <span title="Kod"><Code2 className="w-3.5 h-3.5" aria-hidden="true" /><span className="sr-only">kod</span></span>}
                        {!!project.modelCount && (
                          <span className="inline-flex items-center gap-1" title={`${project.modelCount} 3B model`}>
                            <Box className="w-3.5 h-3.5" aria-hidden="true" /><span className="veri">{project.modelCount}</span>
                          </span>
                        )}
                        {!!project.drawingCount && (
                          <span className="inline-flex items-center gap-1" title={`${project.drawingCount} çizim`}>
                            <PenTool className="w-3.5 h-3.5" aria-hidden="true" /><span className="veri">{project.drawingCount}</span>
                          </span>
                        )}
                        {!!project.electronicsCount && (
                          <span className="inline-flex items-center gap-1" title={`${project.electronicsCount} devre dosyası`}>
                            <CircuitBoard className="w-3.5 h-3.5" aria-hidden="true" /><span className="veri">{project.electronicsCount}</span>
                          </span>
                        )}
                        <span className={`inline-flex items-center gap-1 ${counts.liked ? 'text-isaret' : ''}`} title="Beğeni">
                          <Heart className={`w-3.5 h-3.5 ${counts.liked ? 'fill-isaret' : ''}`} aria-hidden="true" />
                          <span className="veri">{counts.likes}</span>
                        </span>
                        <span className="inline-flex items-center gap-1" title="Yorum">
                          <MessageSquare className="w-3.5 h-3.5" aria-hidden="true" />
                          <span className="veri">{counts.comments}</span>
                        </span>
                      </span>
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
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
