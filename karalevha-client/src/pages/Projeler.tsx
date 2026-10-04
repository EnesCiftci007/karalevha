import { useState, useEffect } from 'react';
import { Terminal, FolderGit2, Star, GitFork, ExternalLink, Plus, Code2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Project } from '../types';

export default function Projeler() {
  const { user, token } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);
  const [showModal, setShowModal] = useState(false);

  // Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [repoUrl, setRepoUrl] = useState('');

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      const res = await fetch('http://localhost:5114/api/projects');
      const data = await res.json();
      setProjects(data);
    } catch (error) {
      console.error('Projeler yüklenemedi:', error);
    } finally {
      setInitialLoad(false);
    }
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !repoUrl.trim()) return;

    setLoading(true);
    try {
      const res = await fetch('http://localhost:5114/api/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ title, description, repoUrl })
      });

      if (res.ok) {
        const newProject = await res.json();
        setProjects([newProject, ...projects]);
        setShowModal(false);
        setTitle('');
        setDescription('');
        setRepoUrl('');
      } else {
        const err = await res.json();
        alert(err.title || "Bir hata oluştu.");
      }
    } catch (error) {
      console.error('Proje oluşturulamadı:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto animate-in fade-in duration-300 pb-20">
      
      {/* Banner */}
      <div className="bg-[#111216] border-2 border-[#1f2129] p-8 mb-8 relative overflow-hidden flex flex-col md:flex-row items-center justify-between group">
        <div className="absolute inset-0 bg-[#00e5ff]/5 blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
        <div className="relative z-10 text-center md:text-left">
          <h1 className="text-4xl font-black uppercase tracking-widest text-white flex items-center justify-center md:justify-start">
            <Terminal className="w-8 h-8 mr-3 text-[#00e5ff]" />
            Açık Kaynak Projeler
          </h1>
          <p className="text-zinc-400 text-[15px] mt-2 font-medium tracking-wide">Yazılım ve Donanım projelerinizi sergileyin, takımlara katılın.</p>
        </div>
        
        {user ? (
          <button 
            onClick={() => setShowModal(true)}
            className="mt-6 md:mt-0 relative flex items-center bg-[#00e5ff] hover:bg-white text-black px-6 py-3 text-[16px] font-black uppercase tracking-widest transition-all duration-300 shadow-[6px_6px_0px_rgba(255,255,255,0.2)] hover:shadow-[8px_8px_0px_#00e5ff] hover:-translate-y-1 hover:-translate-x-1 border-2 border-black z-10"
          >
            <Plus className="w-5 h-5 mr-2" strokeWidth={3} />
            PROJE EKLE
          </button>
        ) : (
          <p className="text-zinc-500 font-bold uppercase mt-6 md:mt-0">Proje eklemek için giriş yapın.</p>
        )}
      </div>

      {/* Projeler Listesi */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {initialLoad ? (
          <div className="col-span-full flex flex-col items-center justify-center py-20 text-[#00e5ff]">
            <Code2 className="w-12 h-12 animate-pulse mb-4" />
            <span className="font-black uppercase tracking-widest text-lg">REPO'LAR ÇEKİLİYOR...</span>
          </div>
        ) : projects.length === 0 ? (
          <div className="col-span-full text-center text-zinc-500 font-bold uppercase py-10">
            Henüz hiç proje eklenmemiş. İlk projeyi sen duyur!
          </div>
        ) : (
          projects.map((project) => (
            <div key={project.id} className="bg-[#0b0c10] border-2 border-[#1f2129] p-6 hover:border-[#00e5ff]/50 transition-colors flex flex-col group relative overflow-hidden">
              <div className="absolute right-0 top-0 w-32 h-32 bg-[url('/baskikorsanlari.png')] bg-cover bg-center opacity-10 group-hover:opacity-20 transition-opacity filter grayscale pointer-events-none transform translate-x-10 -translate-y-10"></div>
              
              <div className="flex justify-between items-start mb-4 relative z-10">
                <div>
                  <h3 className="text-2xl font-black text-white uppercase tracking-wider mb-1 group-hover:text-[#00e5ff] transition-colors">
                    {project.title}
                  </h3>
                  <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest">
                    GELİŞTİRİCİ: {project.owner}
                  </span>
                </div>
                <a href={project.repoUrl} target="_blank" rel="noreferrer" className="text-zinc-400 hover:text-white transition-colors">
                  <FolderGit2 className="w-6 h-6" />
                </a>
              </div>

              <p className="text-zinc-400 text-sm font-medium leading-relaxed mb-8 flex-grow relative z-10">
                {project.description}
              </p>

              <div className="flex items-center justify-between border-t-2 border-[#1f2129] pt-4 mt-auto relative z-10">
                <div className="flex items-center space-x-4">
                  <span className="flex items-center text-zinc-500 font-bold text-sm">
                    <Star className="w-4 h-4 mr-1" /> {project.stars}
                  </span>
                  <span className="flex items-center text-zinc-500 font-bold text-sm">
                    <GitFork className="w-4 h-4 mr-1" /> {project.forks}
                  </span>
                </div>
                <a 
                  href={project.repoUrl} 
                  target="_blank" 
                  rel="noreferrer"
                  className="flex items-center text-xs font-black uppercase tracking-widest text-[#00e5ff] hover:text-white transition-colors"
                >
                  REPO'YA GİT <ExternalLink className="w-3 h-3 ml-1" />
                </a>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal - Proje Ekle */}
      {showModal && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="w-full max-w-md bg-[#111216] border-2 border-[#00e5ff] p-8 shadow-[12px_12px_0px_#00e5ff] relative animate-in zoom-in-95 duration-200">
            
            <button 
              onClick={() => setShowModal(false)}
              className="absolute top-4 right-4 text-zinc-500 hover:text-white transition-colors"
            >
              <Plus className="w-6 h-6 rotate-45" />
            </button>

            <h2 className="text-2xl font-black uppercase tracking-widest text-white mb-6 flex items-center">
              <Code2 className="w-6 h-6 mr-2 text-[#00e5ff]" />
              PROJE EKLE
            </h2>

            <form onSubmit={handleCreateProject} className="space-y-6">
              
              <div className="space-y-2">
                <label className="text-[12px] font-bold text-zinc-400 uppercase tracking-widest">Proje Adı</label>
                <input 
                  type="text" 
                  required
                  maxLength={100}
                  value={title}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTitle(e.target.value)}
                  placeholder="Projenizin adı..."
                  className="w-full bg-[#0b0c10] border-2 border-[#1f2129] px-4 py-3 text-white focus:border-[#00e5ff] outline-none transition-colors"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[12px] font-bold text-zinc-400 uppercase tracking-widest">Açıklama</label>
                <textarea 
                  required
                  maxLength={1000}
                  value={description}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setDescription(e.target.value)}
                  placeholder="Projeniz ne yapıyor? Hangi teknolojiler kullanıldı?"
                  className="w-full bg-[#0b0c10] border-2 border-[#1f2129] px-4 py-3 text-white focus:border-[#00e5ff] outline-none transition-colors min-h-[100px] resize-none"
                ></textarea>
              </div>

              <div className="space-y-2">
                <label className="text-[12px] font-bold text-zinc-400 uppercase tracking-widest">GİTHUB REPO URL</label>
                <input 
                  type="url" 
                  required
                  value={repoUrl}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRepoUrl(e.target.value)}
                  placeholder="https://github.com/kullanici/repo"
                  className="w-full bg-[#0b0c10] border-2 border-[#1f2129] px-4 py-3 text-white focus:border-[#00e5ff] outline-none transition-colors"
                />
              </div>

              <button 
                type="submit"
                disabled={loading}
                className={`w-full py-4 text-[16px] font-black uppercase tracking-widest border-2 border-black transition-all
                  ${loading ? 'bg-zinc-600 text-zinc-400' : 'bg-[#00e5ff] text-black hover:bg-white hover:shadow-[4px_4px_0px_#00e5ff] hover:-translate-y-1'}`}
              >
                {loading ? 'EKLENİYOR...' : 'PROJEYİ DUYUR'}
              </button>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}
