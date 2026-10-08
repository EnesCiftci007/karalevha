import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../services/api';
import { ChevronLeft, Code2, AlertTriangle, ExternalLink, GitBranch } from 'lucide-react';
import { Project } from '../types';
import NativeCodeViewer from '../components/NativeCodeViewer';

export default function ProjeDetay() {
  const { id } = useParams();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchProject = async () => {
      try {
        const data = await api<Project>(`/api/projects/${id}`);
        setProject(data);
      } catch (err) {
        setError('Proje yüklenirken hata oluştu.');
      } finally {
        setLoading(false);
      }
    };
    fetchProject();
  }, [id]);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20 text-[#00e5ff]">
        <Code2 className="w-12 h-12 animate-spin" />
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-red-500">
        <AlertTriangle className="w-12 h-12 mb-4" />
        <h2 className="text-xl font-bold uppercase tracking-widest">{error || 'Proje bulunamadı'}</h2>
        <Link to="/projeler" className="mt-6 text-zinc-500 hover:text-white uppercase font-bold">Geri Dön</Link>
      </div>
    );
  }

  // Parse GitHub URL to Github1s URL
  let isGithub = false;
  let viewerUrl = '';
  
  if (project.repoUrl && project.repoUrl.includes('github.com')) {
    isGithub = true;
    viewerUrl = project.repoUrl.replace('github.com', 'github1s.com');
  }

  return (
    <div className="max-w-7xl mx-auto animate-in fade-in duration-300 pb-20">
      
      <div className="mb-6 flex items-center justify-between">
        <Link to="/projeler" className="flex items-center text-zinc-400 hover:text-[#00e5ff] transition-colors font-bold uppercase tracking-widest text-sm">
          <ChevronLeft className="w-5 h-5 mr-1" />
          Projelere Dön
        </Link>
        <a 
          href={project.repoUrl} 
          target="_blank" 
          rel="noopener noreferrer"
          className="flex items-center text-zinc-400 hover:text-white transition-colors text-sm font-bold uppercase"
        >
          <GitBranch className="w-4 h-4 mr-2" />
          Orijinal Repo
          <ExternalLink className="w-4 h-4 ml-2" />
        </a>
      </div>

      <div className="bg-[#111216] border-2 border-[#1f2129] p-6 mb-6">
        <h1 className="text-3xl font-black uppercase tracking-widest text-white mb-2">{project.title}</h1>
        <p className="text-zinc-400 font-medium mb-4">{project.description}</p>
        <div className="flex items-center space-x-4 text-xs font-bold uppercase text-zinc-500">
          <span>Geliştirici: <span className="text-[#00e5ff]">{project.owner}</span></span>
        </div>
      </div>

      <div className="bg-[#0b0c10] border-2 border-[#1f2129] relative overflow-hidden flex flex-col" style={{ height: '70vh' }}>
        {isGithub ? (
          <NativeCodeViewer repoUrl={project.repoUrl} />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-zinc-500 p-8 text-center">
            <AlertTriangle className="w-12 h-12 mb-4" />
            <h3 className="text-lg font-bold uppercase tracking-widest text-white mb-2">Desteklenmeyen Repo Formatı</h3>
            <p className="mb-4">İnteraktif kod inceleyici şu an sadece GitHub linklerini destekliyor.</p>
            <a 
              href={project.repoUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              className="px-6 py-3 bg-[#00e5ff] text-black font-black uppercase tracking-widest hover:bg-white transition-colors"
            >
              Doğrudan Repoya Git
            </a>
          </div>
        )}
      </div>

    </div>
  );
}
