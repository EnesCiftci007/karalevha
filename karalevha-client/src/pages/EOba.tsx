import React, { useState, useEffect } from 'react';
import { api, API_URL } from '../services/api';
import { Plus, Zap, Hash, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Oba } from '../types';

export default function EOba() {
  const { user, token } = useAuth();
  const [obalar, setObalar] = useState<Oba[]>([]);
  const [showModal, setShowModal] = useState(false);
  
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#39ff14'); 
  const [loading, setLoading] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true); 

  useEffect(() => {
    fetchObalar();
  }, []);

  const fetchObalar = async () => {
    try {
      const data = await api<any>('/api/obalar');
      setObalar(data);
    } catch (error) {
      console.error('Obalar yüklenemedi:', error);
    } finally {
      setInitialLoad(false); 
    }
  };

  const handleCreateOba = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/obalar`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name, description, color })
      });

      if (res.ok) {
        const newOba = await res.json();
        setObalar([newOba, ...obalar]); 
        setShowModal(false); 
        setName('');
        setDescription('');
        setColor('#39ff14');
      }
    } catch (error) {
      console.error('Oba oluşturulamadı:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto animate-in fade-in duration-300 pb-20">
      
      <div className="bg-[#111216] border-2 border-[#1f2129] p-8 mb-8 relative overflow-hidden flex flex-col md:flex-row items-center justify-between group">
        <div className="absolute inset-0 bg-[#39ff14]/5 blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
        <div className="relative z-10 text-center md:text-left">
          <h1 className="text-4xl font-black uppercase tracking-widest text-white flex items-center justify-center md:justify-start">
            <Zap className="w-8 h-8 mr-3 text-[#39ff14]" fill="currentColor" />
            E-Oba
          </h1>
          <p className="text-zinc-400 text-[15px] mt-2 font-medium tracking-wide">Dijital topluluklarınızı yönetin veya yeni obalara katılın.</p>
        </div>
        
        {user ? (
          <button 
            onClick={() => setShowModal(true)}
            className="mt-6 md:mt-0 relative flex items-center bg-[#39ff14] hover:bg-white text-black px-6 py-3 text-[16px] font-black uppercase tracking-widest transition-all duration-300 shadow-[6px_6px_0px_rgba(255,255,255,0.2)] hover:shadow-[8px_8px_0px_#39ff14] hover:-translate-y-1 hover:-translate-x-1 border-2 border-black z-10"
          >
            <Plus className="w-5 h-5 mr-2" strokeWidth={3} />
            YENİ OBA KUR
          </button>
        ) : (
          <p className="text-zinc-500 font-bold uppercase mt-6 md:mt-0">Oba kurmak için giriş yapın.</p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {initialLoad ? (
          <div className="col-span-full flex flex-col items-center justify-center py-20 text-[#39ff14]">
            <Zap className="w-12 h-12 animate-pulse mb-4" />
            <span className="font-black uppercase tracking-widest text-lg">TOPLULUKLAR YÜKLENİYOR...</span>
          </div>
        ) : obalar.length === 0 ? (
          <div className="col-span-full text-center text-zinc-500 font-bold uppercase py-10">
            Hiç Oba Yok. İlk kuran sen ol!
          </div>
        ) : (
          obalar.map((oba) => (
            <Link to={`/e-oba/${oba.id}`} key={oba.id} className="bg-[#0b0c10] border-2 border-[#1f2129] flex flex-col group hover:border-[#39ff14]/50 transition-colors relative overflow-hidden">
              
              <div className="h-24 bg-[#111216] border-b-2 border-[#1f2129] relative flex items-center justify-center overflow-hidden">
                <div className="absolute inset-0 opacity-20 bg-cover bg-center" style={{ backgroundImage: "url('/forum.png')" }}></div>
                <div 
                  className="absolute inset-0 opacity-10"
                  style={{ backgroundColor: oba.color || '#39ff14' }}
                ></div>
                
                <div className="absolute -bottom-8">
                  <div className="w-16 h-16 bg-[#0b0c10] border-2 border-[#1f2129] p-1 shadow-lg relative" style={{ borderColor: oba.color || '#39ff14' }}>
                    <img 
                      src={`https://api.dicebear.com/7.x/bottts/svg?seed=${oba.avatarSeed || oba.name}&backgroundColor=transparent`} 
                      alt={oba.name} 
                      className="w-full h-full object-contain"
                    />
                  </div>
                </div>
              </div>

              <div className="p-6 pt-12 flex flex-col flex-grow text-center">
                <h3 className="text-xl font-black text-white uppercase tracking-wider mb-2 flex items-center justify-center">
                  <Hash className="w-4 h-4 mr-1 text-zinc-500" />
                  {oba.name}
                </h3>
                <p className="text-zinc-400 text-sm font-medium leading-relaxed mb-6 flex-grow">
                  {oba.description || "Açıklama bulunmuyor..."}
                </p>
                
                <div className="flex items-center justify-between mt-auto border-t-2 border-[#1f2129] pt-4">
                  <div className="flex items-center text-zinc-500 font-bold text-xs uppercase tracking-wider">
                    <Users className="w-4 h-4 mr-2" />
                    0 ÜYE
                  </div>
                  <span className="text-xs font-bold text-zinc-600 uppercase tracking-wider">
                    Kurucu: {oba.owner}
                  </span>
                </div>
              </div>
            </Link>
          ))
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="w-full max-w-md bg-[#111216] border-2 border-[#39ff14] p-8 shadow-[12px_12px_0px_#39ff14] relative animate-in zoom-in-95 duration-200">
            
            <button 
              onClick={() => setShowModal(false)}
              className="absolute top-4 right-4 text-zinc-500 hover:text-white transition-colors"
            >
              <Plus className="w-6 h-6 rotate-45" />
            </button>

            <h2 className="text-2xl font-black uppercase tracking-widest text-white mb-6 flex items-center">
              <Zap className="w-6 h-6 mr-2 text-[#39ff14]" />
              YENİ OBA KUR
            </h2>

            <form onSubmit={handleCreateOba} className="space-y-6">
              
              <div className="space-y-2">
                <label className="text-[12px] font-bold text-zinc-400 uppercase tracking-widest">Oba Adı</label>
                <input 
                  type="text" 
                  required
                  maxLength={50}
                  value={name}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
                  placeholder="Oba'nın adını girin..."
                  className="w-full bg-[#0b0c10] border-2 border-[#1f2129] px-4 py-3 text-white focus:border-[#39ff14] outline-none transition-colors"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[12px] font-bold text-zinc-400 uppercase tracking-widest">Açıklama</label>
                <textarea 
                  value={description}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setDescription(e.target.value)}
                  placeholder="Bu oba ne hakkında?"
                  className="w-full bg-[#0b0c10] border-2 border-[#1f2129] px-4 py-3 text-white focus:border-[#39ff14] outline-none transition-colors min-h-[100px] resize-none"
                ></textarea>
              </div>

              <div className="space-y-2">
                <label className="text-[12px] font-bold text-zinc-400 uppercase tracking-widest">Tema Rengi</label>
                <div className="flex items-center space-x-3">
                  <input 
                    type="color" 
                    value={color}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setColor(e.target.value)}
                    className="w-12 h-12 bg-transparent border-none cursor-pointer p-0"
                  />
                  <span className="text-zinc-500 font-bold uppercase">{color}</span>
                </div>
              </div>

              <button 
                type="submit"
                disabled={loading}
                className={`w-full py-4 text-[16px] font-black uppercase tracking-widest border-2 border-black transition-all
                  ${loading ? 'bg-zinc-600 text-zinc-400' : 'bg-[#39ff14] text-black hover:bg-white hover:shadow-[4px_4px_0px_#39ff14] hover:-translate-y-1'}`}
              >
                {loading ? 'KURULUYOR...' : 'OBA YI OLUŞTUR'}
              </button>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}
