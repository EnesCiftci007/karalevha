import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { MessageSquare, Heart, Share2, Send, Flame } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Post } from '../types';

export default function Akis() {
  const { user, token } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);
  const [visibleCount, setVisibleCount] = useState(10);

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

  const handlePostSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || !user) return;

    setLoading(true);
    try {
      const newPost = await api<any>('/api/posts', {
        method: 'POST',
        body: JSON.stringify({ content })
      });
      if (newPost) {
        setPosts([newPost, ...posts]);
        setContent('');
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

  return (
    <div className="max-w-3xl mx-auto space-y-8 animate-in fade-in duration-300 pb-20">
      
      <div className="flex items-center space-x-3 mb-8 border-b-2 border-[#1f2129] pb-4">
        <Flame className="w-8 h-8 text-[#ff5500]" fill="currentColor" />
        <h1 className="text-3xl font-black uppercase tracking-widest text-white">Akış (Meydan)</h1>
      </div>

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
          <div className="flex justify-between items-center mt-4 border-t-2 border-[#1f2129] pt-4">
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

      <div className="space-y-6">
        {initialLoad ? (
          <div className="flex flex-col items-center justify-center py-20 text-[#ff5500]">
            <Flame className="w-12 h-12 animate-pulse mb-4" />
            <span className="font-black uppercase tracking-widest text-lg">MEYDAN YÜKLENİYOR...</span>
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center text-zinc-500 font-bold uppercase py-10">
            Henüz hiç gönderi yok. İlk sesi sen ver!
          </div>
        ) : (
          posts.map((post) => (
            <div key={post.id} className="bg-[#0b0c10] border-2 border-[#1f2129] p-5 hover:border-[#ff5500]/50 transition-colors">
              
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center space-x-3">
                  <img 
                    src={`https://api.dicebear.com/7.x/bottts/svg?seed=${post.user?.avatarSeed || 'default'}&backgroundColor=transparent`} 
                    alt="avatar" 
                    className="w-12 h-12 bg-[#111216] border-2 border-[#1f2129] p-1 rounded-none"
                  />
                  <div>
                    <h3 className="font-bold text-[16px] text-white flex items-center uppercase tracking-wide">
                      {post.user?.username || 'Bilinmeyen Kullanıcı'}
                    </h3>
                    <span className="text-xs font-bold text-zinc-500 tracking-wider uppercase">{formatDate(post.createdAt)}</span>
                  </div>
                </div>
              </div>

              <p className="text-zinc-300 font-medium text-[15px] leading-relaxed mb-6 whitespace-pre-wrap">
                {post.content}
              </p>

              <div className="flex items-center space-x-6 border-t-2 border-[#1f2129] pt-4">
                <button className="flex items-center text-zinc-500 hover:text-[#ff5500] font-bold transition-colors group">
                  <Heart className="w-5 h-5 mr-2 group-hover:scale-110 transition-transform" />
                  0
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
      </div>

    </div>
  );
}
