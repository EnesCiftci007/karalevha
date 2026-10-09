import React, { useState, useEffect, useRef } from 'react';
import { api } from '../../services/api';
import { PostComment } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { Send, Loader2, Trash2, CornerDownRight } from 'lucide-react';

interface PostCommentsProps {
  postId: number;
  onUpdateCount: (newCount: number) => void;
}

export default function PostComments({ postId, onUpdateCount }: PostCommentsProps) {
  const { user } = useAuth();
  const [comments, setComments] = useState<PostComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [hasCommented, setHasCommented] = useState(false);
  const [replyingTo, setReplyingTo] = useState<{ id: number; username: string } | null>(null);

  const formRef = useRef<HTMLFormElement>(null);
  const submitLock = useRef(false);

  useEffect(() => {
    fetchComments();
  }, [postId]);

  const fetchComments = async () => {
    try {
      setLoading(true);
      const data = await api<PostComment[]>(`/api/posts/${postId}/comments`);
      setComments(data);
      
      // Toplam yorum sayısını hesapla ve bildir (Ana yorumlar + Yanıtlar)
      const total = data.reduce((acc, c) => acc + 1 + (c.replies?.length || 0), 0);
      onUpdateCount(total);
    } catch (err) {
      setError('Yorumlar yüklenirken bir hata oluştu.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (submitLock.current) return;
    if (!content.trim() || content.trim().length > 500) return;

    try {
      submitLock.current = true;
      setSubmitting(true);
      
      const response = await api<PostComment>(`/api/posts/${postId}/comments`, {
        method: 'POST',
        body: JSON.stringify({ 
          content: content.trim(), 
          parentCommentId: replyingTo ? replyingTo.id : null 
        })
      });

      if (replyingTo) {
        // Alt yanıt eklendi, sadece arayüzü güncelle
        setComments(prev => prev.map(c => {
          if (c.id === replyingTo.id) {
            return { ...c, replies: [...(c.replies || []), response] };
          }
          return c;
        }));
      } else {
        // Ana yorum eklendi
        setComments(prev => [...prev, response]);
      }

      setContent('');
      setReplyingTo(null);
      setHasCommented(true);
      
      // Toplamı güncelle
      setComments(currentComments => {
        const total = currentComments.reduce((acc, c) => acc + 1 + (c.replies?.length || 0), 0);
        // Timeout kullanarak component life-cycle dışına çıkartıyoruz ki React State uyarı vermesin
        setTimeout(() => onUpdateCount(total), 0);
        return currentComments;
      });

    } catch (err) {
      console.error('Yorum eklenirken hata:', err);
      alert('Yorum gönderilemedi. Lütfen tekrar deneyin.');
    } finally {
      setSubmitting(false);
      submitLock.current = false;
    }
  };

  const handleDelete = async (commentId: number, parentId: number | null) => {
    if (!window.confirm('Yorumu silmek istediğinize emin misiniz?')) return;

    try {
      await api(`/api/comments/${commentId}`, { method: 'DELETE' });
      
      setComments(prev => {
        let newComments;
        if (parentId) {
          // Alt yanıt silindi
          newComments = prev.map(c => {
            if (c.id === parentId) {
              return { ...c, replies: c.replies?.filter(r => r.id !== commentId) };
            }
            return c;
          });
        } else {
          // Ana yorum silindi (tüm yanıtlarıyla gider)
          newComments = prev.filter(c => c.id !== commentId);
        }
        
        const total = newComments.reduce((acc, c) => acc + 1 + (c.replies?.length || 0), 0);
        setTimeout(() => onUpdateCount(total), 0);
        return newComments;
      });
      
      if (replyingTo?.id === commentId) {
        setReplyingTo(null);
      }
    } catch (err) {
      console.error('Silme hatası:', err);
      alert('Yorum silinemedi.');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('tr-TR', { 
      day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' 
    });
  };

  const renderComment = (c: PostComment, isReply = false, parentId: number | null = null) => (
    <div key={c.id} className={`flex gap-3 mt-4 ${isReply ? 'ml-8 border-l-2 border-zinc-800 pl-4' : 'pt-4 border-t border-[#1f2129]'}`}>
      <div className="w-8 h-8 rounded-full bg-zinc-800 flex-shrink-0 flex items-center justify-center overflow-hidden border border-zinc-700">
         <img src={`https://api.dicebear.com/7.x/bottts/svg?seed=${c.user.avatarSeed || c.user.username}`} alt="avatar" className="w-full h-full object-cover" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-bold text-white text-sm">{c.user.username}</span>
          <span className="text-zinc-500 text-xs">{formatDate(c.createdAt)}</span>
        </div>
        <p className="text-zinc-300 text-sm break-words whitespace-pre-wrap">{c.content}</p>
        
        <div className="flex items-center gap-4 mt-2">
          {!isReply && user && (
            <button 
              onClick={() => { 
                setReplyingTo({ id: c.id, username: c.user.username }); 
                setHasCommented(false);
                setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth' }), 0); 
              }}
              className="text-xs font-semibold text-zinc-500 hover:text-[#ff5500] transition-colors flex items-center gap-1"
            >
              <CornerDownRight className="w-3 h-3" /> Yanıtla
            </button>
          )}
          {user?.id === c.user.id && (
            <button 
              onClick={() => handleDelete(c.id, isReply ? parentId : null)}
              className="text-xs font-semibold text-red-500/70 hover:text-red-500 transition-colors flex items-center gap-1"
            >
              <Trash2 className="w-3 h-3" /> Sil
            </button>
          )}
        </div>
      </div>
    </div>
  );

  if (loading) {
    return <div className="flex justify-center p-4"><Loader2 className="w-6 h-6 animate-spin text-[#ff5500]" /></div>;
  }

  if (error) {
    return <div className="text-red-500 text-sm text-center p-4">{error}</div>;
  }

  return (
    <div className="mt-4">
      
      {comments.length > 0 && (
        <div className="max-h-96 overflow-y-auto mb-4 pr-2 custom-scrollbar bg-[#15161b] rounded-lg p-4">
          {comments.map(c => (
            <div key={c.id}>
              {renderComment(c, false, null)}
              {c.replies?.map(r => renderComment(r, true, c.id))}
            </div>
          ))}
        </div>
      )}

      {user && !hasCommented ? (
        <form ref={formRef} onSubmit={handleSubmit} className="bg-[#15161b] rounded-lg p-4 mt-4">
          {replyingTo && (
            <div className="flex items-center justify-between mb-2 bg-[#ff5500]/10 text-[#ff5500] px-3 py-1.5 rounded-md text-xs font-semibold">
              <div className="flex items-center gap-1">
                <CornerDownRight className="w-3 h-3" />
                <span><span className="text-white">{replyingTo.username}</span> kullanıcısına yanıt veriyorsun</span>
              </div>
              <button type="button" onClick={() => setReplyingTo(null)} className="hover:text-white ml-4">
                İptal
              </button>
            </div>
          )}
          
          <div className="flex items-end gap-2">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={replyingTo ? "Yanıtınızı yazın..." : "Gönderiye yorum yap..."}
              className="flex-1 bg-[#1a1b23] text-white border border-zinc-800 rounded-lg p-3 text-sm focus:outline-none focus:border-[#ff5500] resize-none h-12 min-h-[48px] max-h-32 transition-colors"
              maxLength={500}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
            />
            <button
              type="submit"
              disabled={submitting || !content.trim()}
              className="bg-[#ff5500] text-white h-12 w-12 rounded-lg flex items-center justify-center font-bold hover:bg-[#ff7733] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
            >
              {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
            </button>
          </div>
        </form>
      ) : user && hasCommented ? (
        <div className="mt-4 text-center">
          <p className="text-sm text-green-500/80 font-semibold">Yorum eklendi.</p>
        </div>
      ) : (
        <div className="mt-4 bg-[#15161b] rounded-lg p-4 text-center">
          <p className="text-sm text-zinc-500">Yorum yapmak için giriş yapmalısın.</p>
        </div>
      )}
    </div>
  );
}
