import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { MessageSquare, Heart, Share2, Send, Flame, Hash, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Post } from '../types';
import { Link } from 'react-router-dom';

const AVAILABLE_TAGS = ['Yazılım', 'Robotik', '3B Baskı', 'Elektronik', 'El İşi', 'Tasarım', 'Oyun Geliştirme', 'IoT', 'Duyuru'];

export default function Akis() {
  const { user } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [content, setContent] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);
  const [visibleCount, setVisibleCount] = useState(10);
  const [activeFilter, setActiveFilter] = useState<string | null>(null);

  const fetchPosts = async () => {
    try {
      const data = await api<any>('/api/posts');
      setPosts(data);
    } catch (error) {
      console.error('Gönderiler yüklenemedi:', error);
    } finally {
      setInitialLoad(false);
    }
  };

  useEffect(() => {
    const handleScroll = () => {
      if (window.innerHeight + document.documentElement.scrollTop >= document.documentElement.offsetHeight - 200) {
        setVisibleCount(prev => prev + 5);
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    fetchPosts();
  }, []);

  const toggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(prev => prev.filter(t => t !== tag));
    } else {
      if (selectedTags.length < 3) setSelectedTags([...selectedTags, tag]);
    }
  };

  const handlePostSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || !user) return;

    setLoading(true);
    try {
      const newPost = await api<any>('/api/posts', {
        method: 'POST',
        body: JSON.stringify({ content, tags: selectedTags })
      });
      if (newPost) {
        setPosts([newPost, ...posts]);
        setContent('');
        setSelectedTags([]);
      }
    } catch (error) {
      console.error('Gönderi paylaşılamadı:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('tr-TR', { 
      day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' 
    });
  };

  const filteredPosts = activeFilter 
    ? posts.filter(p => p.tags && p.tags.includes(activeFilter))
    : posts;

  return (
    <div className="max-w-6xl mx-auto px-4 animate-in fade-in duration-300 pb-20">
      
      <div className="flex items-center space-x-3 mb-8 border-b-2 border-[#1f2129] pb-4">
        <Flame className="w-8 h-8 text-[#ff5500]" fill="currentColor" />
        <h1 className="text-3xl font-black uppercase tracking-widest text-white">Akış (Meydan)</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        
        {/* Sol Kolon - Akış */}
        <div className="lg:col-span-3 space-y-8">
          
          {user ? (
            <form onSubmit={handlePostSubmit} className="bg-[#111216] border-2 border-[#1f2129] p-4 flex flex-col focus-within:border-[#ff5500] transition-colors duration-300 relative group">
              <div className="absolute -inset-1 bg-[#ff5500]/20 blur-lg opacity-0 group-focus-within:opacity-100 transition-opacity duration-500 -z-10"></div>
              <textarea 
                value={content}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setContent(e.target.value)}
                placeholder="Neler düşünüyorsunuz? Fikrinizi paylaşın..."
                className="bg-transparent text-white placeholder:text-zinc-600 outline-none resize-none min-h-[100px] text-[16px] font-medium custom-scrollbar"
                required
                maxLength={1000}
              ></textarea>
              
              {/* Etiket Seçimi */}
              <div className="mt-2 mb-4">
                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">Etiket Ekle (Maks 3)</p>
                <div className="flex flex-wrap gap-2">
                  {AVAILABLE_TAGS.map(tag => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleTag(tag)}
                      className={`px-2 py-1 text-[10px] font-black uppercase tracking-widest border-2 transition-colors ${selectedTags.includes(tag) ? 'border-[#ff5500] text-[#ff5500] bg-[#ff5500]/10' : 'border-zinc-800 text-zinc-500 hover:border-zinc-600'}`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex justify-between items-center border-t-2 border-[#1f2129] pt-4">
                <div className="flex space-x-4 text-zinc-500">
                  <span className="text-xs font-bold uppercase tracking-widest">
                    {user.username} olarak yazıyorsun
                  </span>
                </div>
                <button 
                  type="submit"
                  disabled={loading}
                  className={`px-6 py-2 font-black uppercase tracking-widest flex items-center transition-all border-2 border-black
                    ${loading ? 'bg-zinc-600 text-zinc-400 cursor-not-allowed' : 'bg-[#ff5500] text-black hover:bg-white hover:-translate-y-1 hover:shadow-[4px_4px_0px_#ff5500]'}`}
                >
                  <Send className="w-4 h-4 mr-2" strokeWidth={3} />
                  {loading ? '...' : 'GÖNDER'}
                </button>
              </div>
            </form>
          ) : (
            <div className="bg-[#111216] border-2 border-[#1f2129] p-6 text-center">
              <p className="text-zinc-400 font-bold uppercase tracking-widest">Gönderi paylaşmak için giriş yapmalısınız.</p>
            </div>
          )}

          {/* Filtre Temizle */}
          {activeFilter && (
            <div className="flex items-center justify-between bg-[#ff5500]/10 border-2 border-[#ff5500]/30 p-3">
              <span className="text-[#ff5500] font-bold text-sm uppercase tracking-widest">
                #{activeFilter} etiketine sahip gönderiler listeleniyor
              </span>
              <button 
                onClick={() => setActiveFilter(null)}
                className="text-xs font-black text-white hover:text-[#ff5500] uppercase tracking-widest underline decoration-2 underline-offset-4"
              >
                Filtreyi Temizle
              </button>
            </div>
          )}

          <div className="space-y-6">
            {initialLoad ? (
              <div className="flex flex-col items-center justify-center py-20 text-[#ff5500]">
                <Flame className="w-12 h-12 animate-pulse mb-4" />
                <span className="font-black uppercase tracking-widest text-lg">MEYDAN YÜKLENİYOR...</span>
              </div>
            ) : filteredPosts.length === 0 ? (
              <div className="text-center text-zinc-500 font-bold uppercase py-10">
                Bu alanda henüz gönderi yok.
              </div>
            ) : (
              filteredPosts.slice(0, visibleCount).map((post) => (
                <div key={post.id} className="bg-[#0b0c10] border-2 border-[#1f2129] p-5 hover:border-[#ff5500]/50 transition-colors">
                  
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center space-x-3">
                      <Link to={`/profil/${post.user?.username || post.username}`}>
                        <img 
                          src={`https://api.dicebear.com/7.x/bottts/svg?seed=${post.user?.avatarSeed || post.avatarSeed || 'default'}&backgroundColor=transparent`} 
                          alt="avatar" 
                          className="w-12 h-12 bg-[#111216] border-2 border-[#1f2129] p-1 rounded-none hover:border-[#ff5500] transition-colors cursor-pointer"
                        />
                      </Link>
                      <div>
                        <Link to={`/profil/${post.user?.username || post.username}`} className="font-bold text-[16px] text-white flex items-center uppercase tracking-wide hover:text-[#ff5500] transition-colors cursor-pointer">
                          {post.user?.username || post.username || 'Bilinmeyen Kullanıcı'}
                        </Link>
                        <span className="text-xs font-bold text-zinc-500 tracking-wider uppercase">{formatDate(post.createdAt)}</span>
                      </div>
                    </div>
                  </div>

                  <p className="text-zinc-300 font-medium text-[15px] leading-relaxed mb-4 whitespace-pre-wrap">
                    {post.content}
                  </p>

                  {/* Post Tags */}
                  {post.tags && post.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-4">
                      {post.tags.map((t, i) => (
                        <span 
                          key={i} 
                          onClick={() => setActiveFilter(t)}
                          className="cursor-pointer px-2 py-0.5 text-[10px] font-black text-[#ff5500] uppercase tracking-widest border border-[#ff5500]/30 hover:bg-[#ff5500]/10 transition-colors"
                        >
                          #{t}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center space-x-6 border-t-2 border-[#1f2129] pt-4">
                    <button className="flex items-center text-zinc-500 hover:text-[#ff5500] font-bold transition-colors group">
                      <Heart className="w-5 h-5 mr-2 group-hover:scale-110 transition-transform" />
                      {post.likes || 0}
                    </button>
                    <button className="flex items-center text-zinc-500 hover:text-white font-bold transition-colors group">
                      <MessageSquare className="w-5 h-5 mr-2 group-hover:scale-110 transition-transform" />
                      0
                    </button>
                    <button className="flex items-center text-zinc-500 hover:text-white font-bold transition-colors group ml-auto">
                      <Share2 className="w-5 h-5 group-hover:scale-110 transition-transform" />
                    </button>
                  </div>

                </div>
              ))
            )}

            {filteredPosts.length > visibleCount && (
              <div className="flex justify-center py-6">
                <Loader2 className="w-6 h-6 animate-spin text-[#ff5500]" />
              </div>
            )}
          </div>
        </div>

        {/* Sağ Kolon - Gündem / Etiketler */}
        <div className="hidden lg:block lg:col-span-1">
          <div className="sticky top-24 bg-[#111216] border-2 border-[#1f2129] p-5">
            <h3 className="text-[14px] font-black text-white uppercase tracking-widest mb-6 flex items-center border-b-2 border-[#1f2129] pb-3">
              <Hash className="w-5 h-5 mr-2 text-[#ff5500]" />
              Gündem / Başlıklar
            </h3>
            <div className="flex flex-col space-y-1">
              <button 
                onClick={() => setActiveFilter(null)}
                className={`text-left px-3 py-2 text-xs font-bold uppercase tracking-widest transition-colors ${!activeFilter ? 'bg-[#ff5500] text-black' : 'text-zinc-400 hover:bg-[#1f2129] hover:text-white'}`}
              >
                Karışık Akış (Tümü)
              </button>
              {AVAILABLE_TAGS.map(tag => (
                <button 
                  key={tag}
                  onClick={() => setActiveFilter(tag)}
                  className={`text-left px-3 py-2 text-xs font-bold uppercase tracking-widest transition-colors ${activeFilter === tag ? 'bg-[#ff5500] text-black' : 'text-zinc-400 hover:bg-[#1f2129] hover:text-white'}`}
                >
                  #{tag}
                </button>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
