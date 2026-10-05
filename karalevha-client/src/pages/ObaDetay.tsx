import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api, API_URL } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Hash, Volume2, Send, Users, ChevronLeft, Zap, MessageSquare, Lock } from 'lucide-react';

interface Channel {
  id: number;
  name: string;
  type: string;
}

interface Message {
  id: number;
  content: string;
  createdAt: string;
  user: {
    id: number;
    username: string;
  };
}

export default function ObaDetay() {
  const { id } = useParams();
  const { user, token } = useAuth();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [needsPassword, setNeedsPassword] = useState(false);
  const [password, setPassword] = useState('');
  const [joinError, setJoinError] = useState('');
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchChannels();
  }, [id]);

  useEffect(() => {
    if (activeChannel) {
      fetchMessages();
      // Simple polling for new messages every 3 seconds
      const interval = setInterval(fetchMessages, 3000);
    
  if (needsPassword) {
    return (
      <div className="flex h-[calc(100vh-100px)] items-center justify-center bg-[#0b0c10] border-2 border-[#1f2129]">
        <div className="w-full max-w-md bg-[#111216] border-2 border-[#1f2129] p-8 text-center animate-in zoom-in-95">
          <div className="w-16 h-16 mx-auto mb-6 bg-red-500/10 text-red-500 border-2 border-red-500/50 flex items-center justify-center">
            <Lock className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-black text-white uppercase tracking-widest mb-2">GİZLİ OBA</h2>
          <p className="text-zinc-400 font-medium mb-8">Bu obaya girmek için şifre gerekiyor.</p>
          
          <form onSubmit={handleJoin} className="space-y-4">
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Şifreyi girin..."
              className="w-full bg-[#0b0c10] border-2 border-[#1f2129] px-4 py-3 text-white focus:border-[#39ff14] text-center font-bold tracking-widest outline-none"
            />
            {joinError && <p className="text-red-500 text-sm font-bold">{joinError}</p>}
            <button 
              type="submit"
              className="w-full py-3 bg-[#39ff14] text-black font-black uppercase tracking-widest hover:bg-white hover:shadow-[4px_4px_0px_#39ff14] hover:-translate-y-1 transition-all border-2 border-black"
            >
              GİRİŞ YAP
            </button>
          </form>
          
          <Link to="/e-oba" className="block mt-6 text-zinc-500 hover:text-white font-bold uppercase text-sm">Geri Dön</Link>
        </div>
      </div>
    );
  }

  return () => clearInterval(interval);
    }
  }, [activeChannel]);

  useEffect(() => {
    // Scroll to bottom when messages change
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);


  const fetchChannels = async () => {
    try {
      const res = await fetch(`${API_URL}/api/obachannels/${id}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (res.status === 403) {
        setNeedsPassword(true);
        setLoading(false);
        return;
      }
      
      if (res.ok) {
        const data = await res.json();
        setChannels(data);
        if (data.length > 0) {
          setActiveChannel(data[0]);
        }
      }
    } catch (error) {
      console.error('Kanallar yüklenemedi:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async () => {
    if (!activeChannel) return;
    try {
      const data = await api<Message[]>(`/api/obamessages/${activeChannel.id}`);
      setMessages(data);
    } catch (error) {
      console.error('Mesajlar yüklenemedi:', error);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeChannel || !user) return;

    try {
      const res = await fetch(`${API_URL}/api/obamessages/${activeChannel.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ content: newMessage })
      });

      if (res.ok) {
        const msg = await res.json();
        setMessages(prev => [...prev, msg]);
        setNewMessage('');
      }
    } catch (error) {
      console.error('Mesaj gönderilemedi:', error);
    }
  };


  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/obalar/${id}/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ password })
      });
      if (res.ok) {
        setNeedsPassword(false);
        fetchChannels();
      } else {
        const txt = await res.text();
        setJoinError(txt || "Şifre yanlış!");
        setLoading(false);
      }
    } catch(err) {
      setJoinError("Bir hata oluştu.");
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-100px)] items-center justify-center text-[#39ff14]">
        <Zap className="w-12 h-12 animate-pulse mb-4" />
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-100px)] bg-[#0b0c10] border-2 border-[#1f2129] overflow-hidden">
      
      {/* SIDEBAR (Channels) */}
      <div className="w-64 bg-[#111216] border-r-2 border-[#1f2129] flex flex-col flex-shrink-0">
        <div className="h-16 flex items-center px-4 border-b-2 border-[#1f2129]">
          <Link to="/e-oba" className="text-zinc-400 hover:text-white transition-colors mr-3">
            <ChevronLeft className="w-6 h-6" />
          </Link>
          <h2 className="text-white font-black uppercase tracking-wider truncate">OBA SUNUCUSU</h2>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          <div className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-3 px-2">METİN KANALLARI</div>
          
          <div className="space-y-1">
            {channels.map(channel => (
              <button
                key={channel.id}
                onClick={() => setActiveChannel(channel)}
                className={`w-full flex items-center px-3 py-2 text-left transition-colors ${
                  activeChannel?.id === channel.id 
                    ? 'bg-[#39ff14]/10 text-[#39ff14]' 
                    : 'text-zinc-400 hover:bg-[#1f2129] hover:text-zinc-200'
                }`}
              >
                {channel.type === 'voice' ? (
                  <Volume2 className="w-4 h-4 mr-2" />
                ) : (
                  <Hash className="w-4 h-4 mr-2" />
                )}
                <span className="font-bold truncate">{channel.name}</span>
              </button>
            ))}
          </div>
        </div>
        
        {/* User Status Area like Discord */}
        {user && (
          <div className="h-16 bg-[#0b0c10] border-t-2 border-[#1f2129] flex items-center px-4">
             <div className="w-8 h-8 rounded-full bg-[#39ff14]/20 border border-[#39ff14] flex items-center justify-center text-[#39ff14] font-black mr-3">
                {user.username.charAt(0).toUpperCase()}
             </div>
             <div className="flex flex-col">
                <span className="text-white font-bold text-sm leading-tight">{user.username}</span>
                <span className="text-[#39ff14] text-xs font-bold">Çevrimiçi</span>
             </div>
          </div>
        )}
      </div>

      {/* MAIN CHAT AREA */}
      <div className="flex-1 flex flex-col bg-[#0b0c10] relative">
        {/* Chat Header */}
        <div className="h-16 border-b-2 border-[#1f2129] flex items-center px-6 justify-between flex-shrink-0 bg-[#111216]">
          <div className="flex items-center text-white">
            <Hash className="w-5 h-5 text-zinc-400 mr-2" />
            <h3 className="font-black text-lg tracking-wider">{activeChannel?.name || 'Kanal'}</h3>
          </div>
          <div className="flex items-center text-zinc-400">
            <Users className="w-5 h-5 hover:text-white cursor-pointer transition-colors" />
          </div>
        </div>

        {/* Messages List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-zinc-500">
              <MessageSquare className="w-12 h-12 mb-4 opacity-50" />
              <p className="font-bold uppercase tracking-widest text-sm">BURASI HENÜZ SESSİZ. İLK MESAJI GÖNDER!</p>
            </div>
          ) : (
            messages.map((msg, idx) => {
              const isMe = user?.id === msg.user.id;
              
              // Only show user avatar and name if previous message was from a different user or time gap is large (simplified here)
              const showHeader = idx === 0 || messages[idx - 1].user.id !== msg.user.id;

              return (
                <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                  <div className={`flex max-w-[70%] ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                    
                    {/* Avatar */}
                    {showHeader ? (
                      <div className={`w-10 h-10 flex-shrink-0 flex items-center justify-center font-black ${
                        isMe ? 'ml-3 bg-[#39ff14]/20 text-[#39ff14] border border-[#39ff14]' : 'mr-3 bg-zinc-800 text-zinc-300 border border-zinc-700'
                      }`}>
                        {msg.user.username.charAt(0).toUpperCase()}
                      </div>
                    ) : (
                      <div className="w-10 h-10 flex-shrink-0 ml-3 mr-3"></div> // Spacer
                    )}

                    {/* Message Bubble */}
                    <div className="flex flex-col">
                      {showHeader && (
                        <div className={`flex items-baseline mb-1 ${isMe ? 'justify-end' : 'justify-start'}`}>
                          <span className={`font-bold mr-2 ${isMe ? 'text-[#39ff14]' : 'text-zinc-300'}`}>
                            {msg.user.username}
                          </span>
                          <span className="text-[10px] text-zinc-500 font-bold">
                            {new Date(msg.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                          </span>
                        </div>
                      )}
                      <div className={`px-4 py-2 rounded-sm text-sm break-words ${
                        isMe ? 'bg-[#39ff14] text-black font-medium' : 'bg-[#1f2129] text-zinc-200'
                      }`}>
                        {msg.content}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        {user ? (
          <div className="p-4 bg-[#111216] border-t-2 border-[#1f2129]">
            <form onSubmit={handleSendMessage} className="relative flex items-center">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder={`${activeChannel?.name || 'kanal'} kanalına mesaj gönder...`}
                className="w-full bg-[#0b0c10] border-2 border-[#1f2129] text-white px-4 py-3 pr-12 focus:outline-none focus:border-[#39ff14] transition-colors font-medium placeholder-zinc-600"
              />
              <button
                type="submit"
                disabled={!newMessage.trim()}
                className="absolute right-2 p-2 bg-[#39ff14] text-black hover:bg-white transition-colors disabled:opacity-50 disabled:hover:bg-[#39ff14]"
              >
                <Send className="w-5 h-5" />
              </button>
            </form>
          </div>
        ) : (
          <div className="p-4 bg-[#111216] border-t-2 border-[#1f2129] text-center">
            <span className="text-zinc-500 font-bold uppercase tracking-wider text-sm">Mesaj göndermek için giriş yapmalısınız</span>
          </div>
        )}
      </div>
    </div>
  );
}
