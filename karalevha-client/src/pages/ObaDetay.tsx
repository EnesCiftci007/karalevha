import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import * as signalR from '@microsoft/signalr';
import { api, API_URL } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Hash, Volume2, Send, Users, ChevronLeft, Zap, MessageSquare, Lock, Menu, X, Plus, Paperclip, FolderOpen, LogIn } from 'lucide-react';
import Attachment, { FileTypeIcon } from '../components/oba/Attachment';
import FileViewer from '../components/oba/FileViewer';
import { MAX_FILE_SIZE, ObaFile, canPreview, downloadObaFile, formatSize } from '../services/files';

interface Channel {
  id: number;
  name: string;
  type: string;
  category: string;
  oba?: any;
}

interface Message {
  id: number;
  content: string;
  createdAt: string;
  user: {
    id: number;
    username: string;
  };
  file?: ObaFile | null;
  uploading?: boolean; // sadece istemcide: dosya henüz sunucuya gidiyor
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
  const [connection, setConnection] = useState<signalR.HubConnection | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  

  const [needsLogin, setNeedsLogin] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [sendError, setSendError] = useState('');
  const [viewer, setViewer] = useState<{ messageId: number; file: ObaFile } | null>(null);
  const [showFiles, setShowFiles] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Setup SignalR connection
  // Misafirler de bağlanır: açık obaları canlı olarak (salt okunur) izleyebilirler.
  useEffect(() => {
    const newConnection = new signalR.HubConnectionBuilder()
      .withUrl(`${import.meta.env.VITE_API_URL || API_URL}/chathub`)
      .withAutomaticReconnect()
      .build();

    setConnection(newConnection);
    return () => {
      setIsConnected(false);
      newConnection.stop().catch(() => {});
    };
    // Hub kimlik istemiyor; giriş/çıkışta yeniden bağlanmaya gerek yok
  }, []);

  const [isConnected, setIsConnected] = useState(false);

  // Connect and subscribe to messages
  useEffect(() => {
    if (connection) {
      connection.start()
        .then(() => {
          console.log('Connected to SignalR');
          setIsConnected(true);
          
          connection.on('ReceiveMessage', (message: Message) => {
            setMessages(prev => {
              if (prev.some(m => m.id === message.id)) return prev;
              return [...prev, message];
            });
          });
        })
        .catch(e => console.log('Connection failed: ', e));
    }
  }, [connection]);

  // Join channel group when activeChannel changes OR when connection establishes
  useEffect(() => {
    if (isConnected && connection && activeChannel) {
      connection.invoke('JoinChannel', activeChannel.id.toString())
        .then(() => console.log("Joined channel: ", activeChannel.id))
        .catch(err => console.error("JoinChannel error: ", err));
        
      return () => {
        // Bağlantı zaten kapandıysa (çıkış, sayfadan ayrılma) ayrılma çağrısı gereksiz
        if (connection.state !== signalR.HubConnectionState.Connected) return;
        connection.invoke('LeaveChannel', activeChannel.id.toString())
          .catch(err => console.error(err));
      };
    }
  }, [isConnected, connection, activeChannel]);


  useEffect(() => {
    fetchChannels();
  }, [id, token]);

  useEffect(() => {
    if (activeChannel) {
      fetchMessages();
      // Simple polling for new messages every 3 seconds


    }
  }, [activeChannel]);

  useEffect(() => {
    // Scroll to bottom when messages change
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);


  const fetchChannels = async () => {
    try {
      const res = await fetch(`${API_URL}/api/obachannels/${id}`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : undefined
      });

      // Gizli oba + giriş yapılmamış: önce giriş gerekli
      if (res.status === 401) {
        setNeedsLogin(true);
        setLoading(false);
        return;
      }
      setNeedsLogin(false);
      
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

  const pickFile = (file: File | undefined | null) => {
    if (!file) return;
    if (file.size > MAX_FILE_SIZE) {
      setSendError(`Dosya en fazla ${formatSize(MAX_FILE_SIZE)} olabilir.`);
      return;
    }
    setSendError('');
    setPendingFile(file);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const currentText = newMessage.trim();
    const currentFile = pendingFile;
    if ((!currentText && !currentFile) || !activeChannel || !user) return;

    setNewMessage('');
    setPendingFile(null);
    setSendError('');

    // Ekrana aninda yansit
    const tempId = -Math.floor(Math.random() * 1000000);
    const optimisticMessage: Message = {
      id: tempId,
      content: currentText,
      createdAt: new Date().toISOString(),
      user: {
        id: user.id,
        username: user.username
      },
      file: currentFile
        ? { name: currentFile.name, size: currentFile.size, contentType: currentFile.type }
        : null,
      uploading: !!currentFile
    };

    setMessages(prev => [...prev, optimisticMessage]);

    // Gonderim basarisiz olursa yazilani ve secilen dosyayi geri koy
    const rollback = (reason: string) => {
      setMessages(prev => prev.filter(m => m.id !== tempId));
      setNewMessage(currentText);
      setPendingFile(currentFile);
      setSendError(reason);
    };

    try {
      let res: Response;
      if (currentFile) {
        const form = new FormData();
        form.append('file', currentFile);
        if (currentText) form.append('content', currentText);
        res = await fetch(`${API_URL}/api/obamessages/${activeChannel.id}/file`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
          body: form
        });
      } else {
        res = await fetch(`${API_URL}/api/obamessages/${activeChannel.id}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ content: currentText })
        });
      }

      if (res.ok) {
        const msg: Message = await res.json();
        // Gercegiyle degistir (SignalR yayini daha once ulastiysa kopyasini at)
        setMessages(prev => prev.filter(m => m.id !== msg.id).map(m => m.id === tempId ? msg : m));
      } else {
        const body = await res.json().catch(() => null);
        rollback(
          body?.message ??
          (res.status === 429 ? 'Çok hızlı gönderiyorsunuz, biraz bekleyin.'
            : res.status === 413 ? `Dosya en fazla ${formatSize(MAX_FILE_SIZE)} olabilir.`
            : 'Mesaj gönderilemedi.')
        );
      }
    } catch (error) {
      console.error('Hata:', error);
      rollback('Sunucuya ulaşılamadı.');
    }
  };

  const sharedFiles = messages.filter(m => m.file && !m.uploading).slice().reverse();

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


  if (needsLogin) {
    return (
      <div className="flex h-[calc(100vh-100px)] items-center justify-center bg-[#0b0c10] border-2 border-[#1f2129]">
        <div className="w-full max-w-md bg-[#111216] border-2 border-[#1f2129] p-8 text-center animate-in zoom-in-95">
          <div className="w-16 h-16 mx-auto mb-6 bg-red-500/10 text-red-500 border-2 border-red-500/50 flex items-center justify-center">
            <Lock className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-black text-white uppercase tracking-widest mb-2">GİZLİ OBA</h2>
          <p className="text-zinc-400 font-medium mb-8">Bu oba gizli. İçeriği görmek için önce giriş yapmalısın.</p>
          <Link
            to="/auth"
            state={{ from: `/e-oba/${id}` }}
            className="flex items-center justify-center w-full py-3 bg-[#39ff14] text-black font-black uppercase tracking-widest hover:bg-white hover:shadow-[4px_4px_0px_#39ff14] hover:-translate-y-1 transition-all border-2 border-black"
          >
            <LogIn className="w-5 h-5 mr-2" strokeWidth={3} />
            GİRİŞ YAP / KAYIT OL
          </Link>
          <Link to="/e-oba" className="block mt-6 text-zinc-500 hover:text-white font-bold uppercase text-sm">Geri Dön</Link>
        </div>
      </div>
    );
  }

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

  return (
    <div className="flex h-[calc(100vh-100px)] bg-[#0b0c10] border-2 border-[#1f2129] overflow-hidden">
      
      {/* SIDEBAR (Channels) */}
      {/* Mobile Overlay */}
      {isSidebarOpen && (
        <div 
          className="absolute inset-0 bg-black/80 z-40 md:hidden" 
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
      
      {/* SIDEBAR (Channels) */}
      <div className={`absolute inset-y-0 left-0 z-50 w-72 md:w-64 bg-[#111216] border-r-2 border-[#1f2129] flex flex-col flex-shrink-0 transform transition-transform duration-200 ease-in-out md:relative md:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        {/* Mobile close button inside sidebar header */}
        <button onClick={() => setIsSidebarOpen(false)} className="md:hidden absolute top-4 right-4 text-zinc-400 hover:text-white z-50">
           <X className="w-6 h-6" />
        </button>
        <div className="h-16 flex items-center px-4 border-b-2 border-[#1f2129]">
          <Link to="/e-oba" className="text-zinc-400 hover:text-white transition-colors mr-3">
            <ChevronLeft className="w-6 h-6" />
          </Link>
          <h2 className="text-white font-black uppercase tracking-wider truncate">OBA SUNUCUSU</h2>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          <div className="space-y-4 px-2">
            {Object.entries(channels.reduce((acc, ch) => {
              if (!acc[ch.category]) acc[ch.category] = [];
              acc[ch.category].push(ch);
              return acc;
            }, {} as Record<string, Channel[]>)).map(([categoryName, catChannels]) => (
              <div key={categoryName}>
                <div className="flex items-center justify-between text-xs font-bold text-zinc-500 uppercase tracking-widest mb-1 px-1">
                  <span>{categoryName}</span>
                  {user?.id === activeChannel?.oba?.ownerId && ( // Simplified auth check
                    <Plus className="w-3 h-3 hover:text-white cursor-pointer transition-colors" />
                  )}
                </div>
                <div className="space-y-0.5">
                  {catChannels.map(channel => (
                    <button
                      key={channel.id}
                      onClick={() => { setActiveChannel(channel); setIsSidebarOpen(false); }}
                      className={`w-full flex items-center px-2 py-1.5 rounded text-left transition-colors ${
                        activeChannel?.id === channel.id 
                          ? 'bg-[#39ff14]/10 text-[#39ff14]' 
                          : 'text-zinc-400 hover:bg-[#1f2129] hover:text-zinc-200'
                      }`}
                    >
                      {channel.type === 'voice' ? (
                        <Volume2 className="w-4 h-4 mr-2 opacity-70" />
                      ) : (
                        <Hash className="w-4 h-4 mr-2 opacity-70" />
                      )}
                      <span className="font-semibold truncate text-sm">{channel.name}</span>
                    </button>
                  ))}
                </div>
              </div>
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
      <div
        className="flex-1 min-w-0 flex flex-col bg-[#0b0c10] relative"
        onDragOver={(e) => {
          if (!user || !e.dataTransfer.types.includes('Files')) return;
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(false);
        }}
        onDrop={(e) => {
          if (!user) return;
          e.preventDefault();
          setDragOver(false);
          pickFile(e.dataTransfer.files[0]);
        }}
      >
        {dragOver && (
          <div className="absolute inset-0 z-30 bg-[#39ff14]/10 border-4 border-dashed border-[#39ff14] flex items-center justify-center pointer-events-none">
            <span className="text-[#39ff14] font-black uppercase tracking-widest">Dosyayı buraya bırak</span>
          </div>
        )}
        {/* Chat Header */}
        <div className="h-16 border-b-2 border-[#1f2129] flex items-center px-4 sm:px-6 justify-between flex-shrink-0 bg-[#111216] relative">
          <div className="flex items-center text-white">
            <Link to="/e-oba" className="md:hidden text-zinc-400 hover:text-white transition-colors mr-2">
              <ChevronLeft className="w-6 h-6" />
            </Link>
            <button 
              onClick={() => setIsSidebarOpen(true)} 
              className="md:hidden mr-3 sm:mr-4 text-zinc-400 hover:text-white"
            >
              <Menu className="w-6 h-6" />
            </button>
            <Hash className="w-5 h-5 text-zinc-400 mr-2" />
            <h3 className="font-black text-lg tracking-wider">{activeChannel?.name || 'Kanal'}</h3>
          </div>
          <div className="flex items-center text-zinc-400 space-x-4">
            <button
              type="button"
              onClick={() => setShowFiles(v => !v)}
              className={`flex items-center transition-colors ${showFiles ? 'text-[#39ff14]' : 'hover:text-white'}`}
              title="Paylaşılan dosyalar"
              aria-label="Paylaşılan dosyalar"
            >
              <FolderOpen className="w-5 h-5" />
              {sharedFiles.length > 0 && <span className="ml-1 text-xs font-black">{sharedFiles.length}</span>}
            </button>
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
                      <div className={`w-10 h-10 flex-shrink-0 ${isMe ? 'ml-3' : 'mr-3'}`}></div> // Spacer
                    )}

                    {/* Message Bubble */}
                    <div className="flex flex-col min-w-0">
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
                      {msg.file && (
                        <div className={`flex ${isMe ? 'justify-end' : 'justify-start'} ${msg.content ? 'mb-1' : ''}`}>
                          <Attachment
                            messageId={msg.id}
                            file={msg.file}
                            uploading={msg.uploading}
                            onOpen={() => setViewer({ messageId: msg.id, file: msg.file! })}
                          />
                        </div>
                      )}
                      {msg.content && (
                        <div className={`px-4 py-2 rounded-sm text-sm break-words whitespace-pre-wrap ${
                          isMe ? 'bg-[#39ff14] text-black font-medium' : 'bg-[#1f2129] text-zinc-200'
                        }`}>
                          {msg.content}
                        </div>
                      )}
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
            {sendError && (
              <p className="text-red-500 text-xs font-bold uppercase tracking-wider mb-2" role="alert">{sendError}</p>
            )}
            {pendingFile && (
              <div className="flex items-center mb-2 bg-[#0b0c10] border-2 border-[#39ff14]/40 px-3 py-2">
                <Paperclip className="w-4 h-4 text-[#39ff14] mr-2 flex-shrink-0" />
                <span className="text-sm text-white font-bold truncate">{pendingFile.name}</span>
                <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest ml-2 flex-shrink-0">{formatSize(pendingFile.size)}</span>
                <button type="button" onClick={() => setPendingFile(null)} className="ml-auto pl-2 text-zinc-400 hover:text-red-500" aria-label="Dosyayı kaldır">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
            <form onSubmit={handleSendMessage} className="relative flex items-center">
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={(e) => {
                  pickFile(e.target.files?.[0]);
                  e.target.value = ''; // aynı dosya tekrar seçilebilsin
                }}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute left-2 p-2 text-zinc-400 hover:text-[#39ff14] transition-colors"
                title="Dosya ekle (en fazla 25 MB)"
                aria-label="Dosya ekle"
              >
                <Paperclip className="w-5 h-5" />
              </button>
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                maxLength={2000}
                placeholder={pendingFile ? 'Dosyaya not ekle (isteğe bağlı)...' : `${activeChannel?.name || 'kanal'} kanalına mesaj gönder...`}
                className="w-full bg-[#0b0c10] border-2 border-[#1f2129] text-white pl-12 pr-12 py-3 focus:outline-none focus:border-[#39ff14] transition-colors font-medium placeholder-zinc-600"
              />
              <button
                type="submit"
                disabled={!newMessage.trim() && !pendingFile}
                className="absolute right-2 p-2 bg-[#39ff14] text-black hover:bg-white transition-colors disabled:opacity-50 disabled:hover:bg-[#39ff14]"
                aria-label="Gönder"
              >
                <Send className="w-5 h-5" />
              </button>
            </form>
          </div>
        ) : (
          <div className="p-4 bg-[#111216] border-t-2 border-[#1f2129] text-center">
            <Link
              to="/auth"
              state={{ from: `/e-oba/${id}` }}
              className="text-zinc-400 hover:text-[#39ff14] font-bold uppercase tracking-wider text-sm transition-colors"
            >
              Mesaj ve dosya göndermek için giriş yap →
            </Link>
          </div>
        )}

        {/* Paylaşılan Dosyalar Paneli */}
        {showFiles && (
          <div className="absolute inset-y-0 right-0 z-20 w-full sm:w-80 bg-[#111216] border-l-2 border-[#1f2129] flex flex-col">
            <div className="h-16 flex items-center justify-between px-4 border-b-2 border-[#1f2129] flex-shrink-0">
              <h4 className="text-white font-black uppercase tracking-widest text-sm flex items-center">
                <FolderOpen className="w-4 h-4 mr-2 text-[#39ff14]" />
                Dosyalar
              </h4>
              <button type="button" onClick={() => setShowFiles(false)} className="text-zinc-400 hover:text-white" aria-label="Paneli kapat">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {sharedFiles.length === 0 ? (
                <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest text-center mt-8">
                  Bu kanalda henüz dosya paylaşılmadı.
                </p>
              ) : (
                sharedFiles.map(m => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() =>
                      canPreview(m.file!)
                        ? setViewer({ messageId: m.id, file: m.file! })
                        : downloadObaFile(m.id, m.file!.name).catch(err => console.error(err))
                    }
                    className="w-full flex items-center text-left p-2 bg-[#0b0c10] border-2 border-[#1f2129] hover:border-[#39ff14]/50 transition-colors"
                  >
                    <FileTypeIcon file={m.file!} className="w-5 h-5 text-[#39ff14] mr-3 flex-shrink-0" />
                    <span className="min-w-0">
                      <span className="block text-sm text-white font-bold truncate">{m.file!.name}</span>
                      <span className="block text-[10px] text-zinc-500 font-bold uppercase tracking-widest truncate">
                        {m.user.username} · {formatSize(m.file!.size)} · {new Date(m.createdAt).toLocaleDateString()}
                      </span>
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {viewer && (
        <FileViewer messageId={viewer.messageId} file={viewer.file} onClose={() => setViewer(null)} />
      )}
    </div>
  );
}
