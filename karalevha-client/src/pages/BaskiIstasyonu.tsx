import { useState, useEffect, useRef } from 'react';
import { Box, UploadCloud, Download, FileBox, CheckCircle2, Eye, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { PrintModel } from '../types';
import StlPreview from '../components/StlPreview';

export default function BaskiIstasyonu() {
  const { user, token } = useAuth();
  const [models, setModels] = useState<PrintModel[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null); // Önizleme için dosya url'i tutar
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchModels();
  }, []);

  const fetchModels = async () => {
    try {
      const res = await fetch('http://localhost:5114/api/printmodels');
      const data = await res.json();
      setModels(data);
    } catch (error) {
      console.error('Modeller yüklenemedi:', error);
    } finally {
      setInitialLoad(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files![0];
    if (selectedFile && selectedFile.name.toLowerCase().endsWith('.stl')) {
      setFile(selectedFile);
    } else {
      alert("Lütfen sadece .stl uzantılı dosya seçin!");
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !title.trim()) return;

    setLoading(true);
    const formData = new FormData();
    formData.append('title', title);
    if (description) formData.append('description', description);
    formData.append('file', file);

    try {
      const res = await fetch('http://localhost:5114/api/printmodels', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (res.ok) {
        fetchModels();
        setTitle('');
        setDescription('');
        setFile(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
      } else {
        const error = await res.json();
        alert(error.message || 'Yükleme başarısız.');
      }
    } catch (error) {
      console.error('Yükleme hatası:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('tr-TR', { 
      day: 'numeric', month: 'long', year: 'numeric'
    });
  };

  return (
    <div className="max-w-6xl mx-auto animate-in fade-in duration-300 pb-20">
      
      {/* Banner */}
      <div className="bg-[#111216] border-2 border-[#1f2129] p-8 mb-8 relative overflow-hidden flex flex-col md:flex-row items-center justify-between group">
        <div className="absolute inset-0 bg-[#a855f7]/5 blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
        <div className="relative z-10 text-center md:text-left">
          <h1 className="text-4xl font-black uppercase tracking-widest text-white flex items-center justify-center md:justify-start">
            <Box className="w-8 h-8 mr-3 text-[#a855f7]" />
            3B Baskı İstasyonu
          </h1>
          <p className="text-zinc-400 text-[15px] mt-2 font-medium tracking-wide">STL dosyalarınızı yükleyin, toplulukla paylaşın ve baskıya hazırlayın.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Sol Kolon: Yükleme Formu */}
        <div className="lg:col-span-1">
          <div className="bg-[#0b0c10] border-2 border-[#1f2129] p-6 sticky top-24">
            <h2 className="text-xl font-black uppercase tracking-widest text-white mb-6 flex items-center">
              <UploadCloud className="w-5 h-5 mr-2 text-[#a855f7]" />
              Model Yükle
            </h2>
            
            {user ? (
              <form onSubmit={handleUpload} className="space-y-4">
                <div>
                  <label className="text-[12px] font-bold text-zinc-400 uppercase tracking-widest block mb-2">Proje Adı</label>
                  <input 
                    type="text" 
                    required
                    maxLength={100}
                    value={title}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTitle(e.target.value)}
                    placeholder="Örn: Modüler Robot Kol"
                    className="w-full bg-[#111216] border-2 border-[#1f2129] px-4 py-3 text-white focus:border-[#a855f7] outline-none transition-colors font-medium text-sm"
                  />
                </div>
                
                <div>
                  <label className="text-[12px] font-bold text-zinc-400 uppercase tracking-widest block mb-2">Açıklama</label>
                  <textarea 
                    value={description}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setDescription(e.target.value)}
                    placeholder="Kısa bir açıklama..."
                    className="w-full bg-[#111216] border-2 border-[#1f2129] px-4 py-3 text-white focus:border-[#a855f7] outline-none transition-colors min-h-[80px] resize-none font-medium text-sm"
                  ></textarea>
                </div>

                <div>
                  <label className="text-[12px] font-bold text-zinc-400 uppercase tracking-widest block mb-2">STL Dosyası</label>
                  <div className="relative border-2 border-dashed border-[#1f2129] hover:border-[#a855f7] transition-colors p-6 text-center cursor-pointer bg-[#111216]">
                    <input 
                      type="file" 
                      accept=".stl"
                      required
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <FileBox className={`w-8 h-8 mx-auto mb-2 ${file ? 'text-[#a855f7]' : 'text-zinc-600'}`} />
                    <span className="text-sm font-bold text-zinc-400 uppercase tracking-wider block">
                      {file ? file.name : "Dosya Seç veya Sürükle"}
                    </span>
                    {file && <span className="text-xs text-[#a855f7] mt-2 block font-medium">Seçildi</span>}
                  </div>
                </div>

                <button 
                  type="submit"
                  disabled={loading || !file}
                  className={`w-full py-4 text-[15px] font-black uppercase tracking-widest border-2 border-black transition-all mt-4
                    ${loading || !file ? 'bg-zinc-600 text-zinc-400' : 'bg-[#a855f7] text-black hover:bg-white hover:shadow-[4px_4px_0px_#a855f7] hover:-translate-y-1'}`}
                >
                  {loading ? 'YÜKLENİYOR...' : 'SİSTEME YÜKLE'}
                </button>
              </form>
            ) : (
              <div className="text-center p-6 bg-[#111216] border-2 border-[#1f2129]">
                <p className="text-zinc-500 font-bold uppercase">Model yüklemek için giriş yapmalısınız.</p>
              </div>
            )}
          </div>
        </div>

        {/* Sağ Kolon: Modeller Listesi */}
        <div className="lg:col-span-2 space-y-6">
          <h2 className="text-xl font-black uppercase tracking-widest text-white mb-6 border-b-2 border-[#1f2129] pb-4">
            Topluluk Modelleri
          </h2>

          {initialLoad ? (
            <div className="bg-[#0b0c10] border-2 border-[#1f2129] p-20 flex flex-col items-center justify-center text-[#a855f7]">
              <Box className="w-12 h-12 animate-pulse mb-4" />
              <span className="font-black uppercase tracking-widest text-lg">MODELLER YÜKLENİYOR...</span>
            </div>
          ) : models.length === 0 ? (
            <div className="bg-[#0b0c10] border-2 border-[#1f2129] p-10 text-center text-zinc-500 font-bold uppercase">
              Henüz STL dosyası yüklenmemiş.
            </div>
          ) : (
            models.map(model => (
              <div key={model.id} className="bg-[#111216] border-2 border-[#1f2129] p-6 hover:border-[#a855f7]/50 transition-all flex flex-col md:flex-row items-start md:items-center justify-between group relative overflow-hidden">
                <div className="absolute inset-0 bg-[url('/baski.png')] bg-cover bg-center opacity-5 grayscale group-hover:grayscale-0 transition-all duration-500 z-0"></div>
                
                <div className="relative z-10 flex-grow mb-4 md:mb-0">
                  <div className="flex items-center space-x-2 mb-1">
                    <CheckCircle2 className="w-4 h-4 text-[#a855f7]" />
                    <h3 className="text-lg font-black text-white uppercase tracking-wider">{model.title}</h3>
                  </div>
                  <p className="text-sm font-medium text-zinc-400 mb-3">{model.description}</p>
                  <div className="flex items-center space-x-4 text-xs font-bold text-zinc-500 uppercase tracking-widest">
                    <span>Yükleyen: <span className="text-zinc-300">{model.uploader}</span></span>
                    <span>•</span>
                    <span>{formatDate(model.uploadedAt)}</span>
                  </div>
                </div>

                <div className="relative z-10 shrink-0 flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3">
                  <button
                    onClick={() => setPreviewUrl(`http://localhost:5114${model.fileUrl}`)}
                    className="flex items-center justify-center bg-zinc-800 text-white hover:bg-zinc-700 border-2 border-zinc-600 px-4 py-3 text-sm font-black uppercase tracking-widest transition-all"
                  >
                    <Eye className="w-4 h-4 mr-2" strokeWidth={3} />
                    3B İNCELE
                  </button>
                  <a 
                    href={`http://localhost:5114${model.fileUrl}`} 
                    download
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-center bg-[#a855f7]/10 text-[#a855f7] hover:bg-[#a855f7] hover:text-black border-2 border-[#a855f7] px-4 py-3 text-sm font-black uppercase tracking-widest transition-all shadow-[4px_4px_0px_transparent] hover:shadow-[4px_4px_0px_#1f2129] hover:-translate-y-1"
                  >
                    <Download className="w-4 h-4 mr-2" strokeWidth={3} />
                    İNDİR
                  </a>
                </div>
              </div>
            ))
          )}
        </div>

      </div>

      {/* 3B Önizleme Modal */}
      {previewUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur-md">
          <div className="w-full max-w-4xl bg-[#111216] border-2 border-[#a855f7] h-[80vh] flex flex-col relative shadow-[12px_12px_0px_#a855f7]">
            <div className="h-14 border-b-2 border-[#1f2129] flex items-center justify-between px-6 bg-[#0b0c10]">
              <h3 className="font-black text-white uppercase tracking-widest flex items-center">
                <Box className="w-5 h-5 mr-2 text-[#a855f7]" />
                3B MODEL ÖNİZLEME
              </h3>
              <button onClick={() => setPreviewUrl(null)} className="text-zinc-500 hover:text-[#ff0055] transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="flex-grow bg-[#1a1b22] relative cursor-grab active:cursor-grabbing">
              <StlPreview url={previewUrl} color="#a855f7" />
              <div className="absolute bottom-4 right-4 text-xs font-bold text-zinc-500 uppercase tracking-widest pointer-events-none">
                Fare ile çevir & Yakınlaştır
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
