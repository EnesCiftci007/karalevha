import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom';
import * as signalR from '@microsoft/signalr';
import { api, API_URL } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Hash, Send, ChevronLeft, MessageSquare, Lock, Menu, X, Paperclip, FolderOpen, Trash2, Plus, Pencil, LogOut } from 'lucide-react';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import UserLink from '../components/ui/UserLink';
import Avatar from '../components/ui/Avatar';
import Field from '../components/ui/Field';
import Skeleton from '../components/ui/Skeleton';
import { fullDate } from '../utils/time';
import { Oba } from '../types';
import { forgetOba, lastChannelOf, rememberOba } from '../utils/lastOba';
import Attachment, { FileTypeIcon } from '../components/oba/Attachment';
import FileViewer from '../components/oba/FileViewer';
import ItemMenu from '../components/ui/ItemMenu';
import ChannelFormModal, { categoryLabel, type ChannelDetail, type ChannelSummary } from '../components/oba/ChannelFormModal';
import { MAX_FILE_SIZE, ObaFile, canPreview, downloadObaFile, formatSize } from '../services/files';

type Channel = ChannelSummary;

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
  const [obaName, setObaName] = useState<string | null>(null);
  const [obaOwner, setObaOwner] = useState<string | null>(null);
  // Açık obada okumak serbest, yazmak üyelik ister ("Katıl")
  const [isMember, setIsMember] = useState(false);
  const [joining, setJoining] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const navigate = useNavigate();
  const [toDelete, setToDelete] = useState<Message | null>(null);
  const [, setSearchParams] = useSearchParams();
  // Kanal formu: yeni kanal (bölümüyle) ya da düzenlenen kanal
  const [channelForm, setChannelForm] = useState<{ category?: string; channel?: ChannelDetail } | null>(null);
  const [channelInfo, setChannelInfo] = useState<ChannelDetail | null>(null);
  const [channelToDelete, setChannelToDelete] = useState<Channel | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesBoxRef = useRef<HTMLDivElement>(null);
  const scrolledChannelRef = useRef<number | null>(null);

  // Setup SignalR connection
  // Misafirler de bağlanır: açık obaları canlı olarak (salt okunur) izleyebilirler.
  useEffect(() => {
    const newConnection = new signalR.HubConnectionBuilder()
      .withUrl(`${import.meta.env.VITE_API_URL || API_URL}/chathub`, {
        // Gizli obaların kanalları için kimlik; her (yeniden) bağlanışta güncel jeton okunur
        accessTokenFactory: () => localStorage.getItem('token') ?? '',
      })
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

          connection.on('MessageDeleted', (messageId: number) => {
            setMessages(prev => prev.filter(m => m.id !== messageId));
          });

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

  // Başlıkta göstermek için obanın adı ve kişinin üyeliği (liste herkese açık)
  useEffect(() => {
    let cancelled = false;
    api<Oba[]>('/api/obalar')
      .then((list) => {
        const oba = list.find((o) => String(o.id) === id);
        if (cancelled) return;
        setObaName(oba?.name ?? null);
        setObaOwner(oba?.owner ?? null);
        setIsMember(!!oba?.isMember);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [id, token]);

  const joinPublic = async () => {
    setJoining(true);
    try {
      await api(`/api/obalar/${id}/join`, { method: 'POST', body: JSON.stringify({}) });
      setIsMember(true);
    } catch (err) {
      setSendError(err instanceof Error ? err.message : 'Katılılamadı.');
    } finally {
      setJoining(false);
    }
  };

  useEffect(() => {
    if (activeChannel) {
      fetchMessages();
      // Simple polling for new messages every 3 seconds


    }
  }, [activeChannel]);

  // Yeni mesajda listenin sonuna in. Yalnızca mesaj kutusu kayar; scrollIntoView
  // bütün sayfayı da kaydırıyordu (kanala tıklayınca sayfa en alta iniyordu).
  useEffect(() => {
    const box = messagesBoxRef.current;
    if (!box || !activeChannel) return;
    const sameChannel = scrolledChannelRef.current === activeChannel.id;
    scrolledChannelRef.current = activeChannel.id;
    box.scrollTo({ top: box.scrollHeight, behavior: sameChannel ? 'smooth' : 'auto' });
  }, [messages, activeChannel]);

  // Gizli kanalın kişileri başlıkta gösterilir
  useEffect(() => {
    setChannelInfo(null);
    if (!activeChannel?.isPrivate) return;
    let cancelled = false;
    api<ChannelDetail>(`/api/obachannels/kanal/${activeChannel.id}`)
      .then((d) => !cancelled && setChannelInfo(d))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [activeChannel]);

  // Açık oba ve kanal hatırlanır: E-Oba'ya dönünce burası açılsın
  useEffect(() => {
    if (activeChannel) rememberOba(user?.id, Number(id), activeChannel.id);
  }, [activeChannel, id, user?.id]);

  const selectChannel = (channel: Channel) => {
    setActiveChannel(channel);
    setIsSidebarOpen(false);
    // Bağlantıyla paylaşılabilsin; geçmişe yeni kayıt eklemeden
    setSearchParams({ kanal: String(channel.id) }, { replace: true });
  };

  const openEdit = async (channel: Channel) => {
    try {
      const detail = await api<ChannelDetail>(`/api/obachannels/kanal/${channel.id}`);
      setChannelForm({ channel: detail });
    } catch (err) {
      console.error('Kanal bilgisi alınamadı:', err);
    }
  };


  const fetchChannels = async (selectId?: number) => {
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

      // Oba silinmiş: son açılanlardan çıkar, listeye dön
      if (res.status === 404) {
        forgetOba(user?.id, Number(id));
        navigate('/e-oba', { replace: true });
        return;
      }

      if (res.ok) {
        const data: Channel[] = await res.json();
        setChannels(data);
        // Seçilecek kanal: az önce kaydedilen, bağlantıdaki ?kanal=, bu obada en son açık olan ya da şimdiki; yoksa ilk kanal
        const wanted = selectId ?? (Number(new URLSearchParams(window.location.search).get('kanal')) || lastChannelOf(user?.id, Number(id)));
        setActiveChannel((current) =>
          data.find((c) => c.id === wanted) ?? data.find((c) => c.id === current?.id) ?? data[0] ?? null
        );
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
    setJoinError('');
    try {
      await api(`/api/obalar/${id}/join`, { method: 'POST', body: JSON.stringify({ password }) });
      setPassword('');
      setNeedsPassword(false);
      setIsMember(true);
      setLoading(true);
      fetchChannels();
    } catch (err) {
      setJoinError(err instanceof Error ? err.message : 'Bir hata oluştu.');
    }
  };

  // Kanalları kategoriye göre grupla (sunucudaki sırayı koru)
  const channelGroups = channels.reduce((acc, ch) => {
    (acc[ch.category] ??= []).push(ch);
    return acc;
  }, {} as Record<string, Channel[]>);
  // Yeni kanal var olan bölümlerden birine ya da yeni bir bölüme eklenir
  const textCategories = Object.keys(channelGroups);

  // Aynı kişinin 5 dakika içindeki ardışık mesajları tek başlık altında toplanır
  const startsGroup = (idx: number) => {
    if (idx === 0) return true;
    const prev = messages[idx - 1];
    const cur = messages[idx];
    return prev.user.id !== cur.user.id ||
      new Date(cur.createdAt).getTime() - new Date(prev.createdAt).getTime() > 5 * 60 * 1000;
  };

  // Sayfa iskeleti (MainLayout) obayı üst menünün altındaki alanın tamamına yayar; burada yalnızca o alanı doldururuz
  const shell = 'h-full';

  if (loading) {
    return (
      <div className={`${shell} flex overflow-hidden`} role="status" aria-label="Yükleniyor">
        <div className="hidden md:block w-64 lg:w-72 border-r border-levha-cizgi p-4 space-y-3">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-4 w-36" />
        </div>
        <div className="flex-1 p-6 space-y-5">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-full max-w-md" />
          <Skeleton className="h-4 w-2/3 max-w-sm" />
        </div>
      </div>
    );
  }

  if (needsLogin || needsPassword) {
    return (
      <div className={`${shell} flex items-center justify-center px-4`}>
        <div className="w-full max-w-sm kart p-6">
          <Lock className="w-6 h-6 mb-4 text-tebesir-silik" strokeWidth={1.75} aria-hidden="true" />
          <h1 className="font-display font-bold text-lg text-tebesir">{obaName ?? 'Gizli oba'}</h1>
          {needsLogin ? (
            <>
              <p className="mt-1 text-sm text-tebesir-soluk">Bu oba gizli. İçeriği görmek için önce giriş yap.</p>
              <Link to="/auth" state={{ from: `/e-oba/${id}` }} className="btn-ana w-full mt-6">Giriş yap</Link>
            </>
          ) : (
            <>
              <p className="mt-1 text-sm text-tebesir-soluk">Bu obaya katılmak için kurucunun paylaştığı şifre gerekiyor.</p>
              <form onSubmit={handleJoin} className="mt-6 space-y-4">
                <Field id="oba-katil-sifre" label="Katılım şifresi" error={joinError || undefined}>
                  <input
                    id="oba-katil-sifre"
                    type="password"
                    autoFocus
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="girdi"
                  />
                </Field>
                <button type="submit" disabled={!password.trim()} className="btn-ana w-full">Obaya katıl</button>
              </form>
            </>
          )}
          <Link to="/e-oba" className="btn-sade w-full mt-3">Obalara dön</Link>
        </div>
      </div>
    );
  }

  return (
    <div className={`${shell} flex overflow-hidden relative`}>

      {/* Mobilde kanal listesi açıkken arka plan */}
      {isSidebarOpen && (
        <div className="absolute inset-0 bg-black/60 z-30 md:hidden" onClick={() => setIsSidebarOpen(false)} aria-hidden="true" />
      )}

      {/* KANALLAR */}
      <aside
        className={`absolute inset-y-0 left-0 z-40 w-72 md:w-64 lg:w-72 bg-levha-yuzey md:bg-levha-koyu/60 border-r border-levha-cizgi flex flex-col shrink-0 transition-transform md:relative md:translate-x-0 ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        aria-label="Kanallar"
      >
        <div className="h-14 flex items-center gap-2 px-3 border-b border-levha-cizgi shrink-0">
          <Link to="/e-oba" className="p-1.5 rounded-md text-tebesir-silik hover:text-tebesir hover:bg-levha-yuzey transition-colors" aria-label="Obalara dön">
            <ChevronLeft className="w-4 h-4" />
          </Link>
          <h1 className="flex-1 min-w-0 text-sm font-semibold text-tebesir truncate">{obaName ?? 'Oba'}</h1>
          {isMember && user && user.username !== obaOwner && (
            <ItemMenu label="Oba seçenekleri" actions={[{ label: 'Obadan ayrıl', icon: LogOut, danger: true, onSelect: () => setConfirmLeave(true) }]} />
          )}
          <button onClick={() => setIsSidebarOpen(false)} className="md:hidden p-1.5 rounded-md text-tebesir-silik hover:text-tebesir" aria-label="Kanal listesini kapat">
            <X className="w-4 h-4" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-2 space-y-5">
          {Object.entries(channelGroups).map(([category, list]) => (
            <div key={category}>
              <div className="group/bolum flex items-center justify-between px-2 mb-1">
                <p className="etiket">{categoryLabel(category)}</p>
                {user && isMember && textCategories.includes(category) && (
                  <button
                    type="button"
                    onClick={() => setChannelForm({ category })}
                    className="p-0.5 rounded text-tebesir-silik hover:text-tebesir md:opacity-0 md:group-hover/bolum:opacity-100 focus:opacity-100 transition-opacity"
                    aria-label={`${categoryLabel(category)} bölümüne kanal ekle`}
                    title="Kanal ekle"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                )}
              </div>
              <ul className="space-y-0.5">
                {list.map((channel) => {
                  const active = activeChannel?.id === channel.id;
                  const Icon = channel.isPrivate ? Lock : Hash;
                  return (
                    <li key={channel.id}>
                      <button
                        onClick={() => selectChannel(channel)}
                        aria-current={active ? 'page' : undefined}
                        className={`w-full flex items-center gap-2 h-8 px-2 rounded-md text-sm text-left transition-colors ${
                          active ? 'bg-levha-yuzey text-tebesir font-medium md:bg-levha-yuzey' : 'text-tebesir-soluk hover:bg-levha-yuzey/60 hover:text-tebesir'
                        }`}
                      >
                        <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-isaret' : 'text-tebesir-silik'}`} aria-hidden="true" />
                        <span className="truncate">{channel.name}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
          {user && isMember && (
            <button
              type="button"
              onClick={() => setChannelForm({})}
              className="w-full flex items-center gap-2 h-8 px-2 rounded-md text-sm text-tebesir-silik hover:bg-levha-yuzey/60 hover:text-tebesir transition-colors"
            >
              <Plus className="w-4 h-4" aria-hidden="true" />
              Kanal ekle
            </button>
          )}
        </nav>

        {user && (
          <div className="h-14 flex items-center gap-2.5 px-3 border-t border-levha-cizgi shrink-0">
            <Avatar name={user.username} size="sm" />
            <span className="min-w-0">
              <span className="block text-sm font-medium text-tebesir truncate">{user.username}</span>
              <span className="block text-xs text-tebesir-silik">{isConnected ? 'Bağlı' : 'Bağlanıyor…'}</span>
            </span>
          </div>
        )}
      </aside>

      {/* SOHBET */}
      <section
        className="flex-1 min-w-0 flex flex-col relative"
        aria-label={`#${activeChannel?.name ?? 'kanal'}`}
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
          <div className="absolute inset-2 z-30 rounded-lg border-2 border-dashed border-isaret bg-levha/90 flex items-center justify-center pointer-events-none">
            <span className="text-base font-medium text-tebesir">Dosyayı göndermek için bırak</span>
          </div>
        )}

        {/* Kanal başlığı */}
        <header className="h-14 flex items-center gap-2 px-3 sm:px-4 border-b border-levha-cizgi shrink-0">
          <button onClick={() => setIsSidebarOpen(true)} className="md:hidden p-1.5 rounded-md text-tebesir-silik hover:text-tebesir" aria-label="Kanal listesini aç">
            <Menu className="w-4 h-4" />
          </button>
          {activeChannel?.isPrivate ? (
            <Lock className="w-4 h-4 text-tebesir-silik shrink-0" aria-label="Gizli kanal" />
          ) : (
            <Hash className="w-4 h-4 text-tebesir-silik shrink-0" aria-hidden="true" />
          )}
          <h2 className="min-w-0 text-base font-semibold text-tebesir truncate">{activeChannel?.name ?? 'Kanal'}</h2>
          <span className="flex-1 min-w-0 truncate text-xs text-tebesir-silik">
            {channelInfo && (
              <span title={channelInfo.members.map((m) => m.username).join(', ')}>
                {channelInfo.members.length} kişi<span className="hidden sm:inline"> · {channelInfo.members.slice(0, 4).map((m) => m.username).join(', ')}
                {channelInfo.members.length > 4 && ` +${channelInfo.members.length - 4}`}</span>
              </span>
            )}
          </span>
          {activeChannel?.canManage && (
            <ItemMenu
              label="Kanal seçenekleri"
              actions={[
                { label: activeChannel.isPrivate ? 'Kanalı ve kişileri düzenle' : 'Kanalı düzenle', icon: Pencil, onSelect: () => openEdit(activeChannel) },
                { label: 'Kanalı sil', icon: Trash2, danger: true, onSelect: () => setChannelToDelete(activeChannel) },
              ]}
            />
          )}
          <button
            type="button"
            onClick={() => setShowFiles((v) => !v)}
            aria-pressed={showFiles}
            className={`btn-sade h-8 ${showFiles ? 'bg-levha-yuzey text-tebesir' : ''}`}
          >
            <FolderOpen className="w-4 h-4" aria-hidden="true" />
            <span className="hidden sm:inline">Dosyalar</span>
            {sharedFiles.length > 0 && <span className="veri">{sharedFiles.length}</span>}
          </button>
        </header>

        {/* Mesajlar */}
        <div ref={messagesBoxRef} className="flex-1 overflow-y-auto px-3 sm:px-4 py-4">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center px-6">
              <MessageSquare className="w-6 h-6 mb-3 text-tebesir-silik" strokeWidth={1.5} aria-hidden="true" />
              <p className="text-base font-medium text-tebesir">#{activeChannel?.name} kanalının başı</p>
              <p className="mt-1 text-sm text-tebesir-soluk">Henüz mesaj yok. Bir not, soru ya da dosya paylaşarak başlat.</p>
            </div>
          ) : (
            <ol className="space-y-0.5">
              {messages.map((msg, idx) => {
                const first = startsGroup(idx);
                const canDelete = !!user && msg.id > 0 && (user.id === msg.user.id || user.username === obaOwner || !!user.isAdmin);
                return (
                  <li key={msg.id} className={`group relative flex gap-3 px-2 py-1 rounded-md hover:bg-levha-yuzey/50 ${first && idx > 0 ? 'mt-3' : ''}`}>
                    {canDelete && (
                      <button
                        type="button"
                        onClick={() => setToDelete(msg)}
                        className="absolute right-2 top-1 p-1.5 rounded-md text-tebesir-silik hover:text-hata hover:bg-levha opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                        aria-label="Mesajı sil"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                    <div className="w-8 shrink-0">
                      {first ? (
                        <Avatar name={msg.user.username} size="sm" />
                      ) : (
                        <time dateTime={msg.createdAt} className="hidden group-hover:block pt-0.5 text-right veri">
                          {new Date(msg.createdAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                        </time>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      {first && (
                        <div className="flex items-baseline gap-2">
                          <UserLink username={msg.user.username} className={`text-sm font-semibold ${user?.id === msg.user.id ? 'text-isaret' : 'text-tebesir'}`} />
                          <time dateTime={msg.createdAt} title={fullDate(msg.createdAt)} className="text-xs text-tebesir-silik">
                            {new Date(msg.createdAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                          </time>
                        </div>
                      )}
                      {msg.content && (
                        <p className={`text-base leading-relaxed whitespace-pre-wrap break-words ${msg.id < 0 ? 'text-tebesir-silik' : 'text-tebesir'}`}>
                          {msg.content}
                        </p>
                      )}
                      {msg.file && (
                        <div className="mt-1.5">
                          <Attachment
                            messageId={msg.id}
                            file={msg.file}
                            uploading={msg.uploading}
                            onOpen={() => setViewer({ messageId: msg.id, file: msg.file! })}
                          />
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </div>

        {/* Yazma alanı */}
        <div className="px-3 sm:px-4 pb-3 sm:pb-4 shrink-0">
          {user && !isMember ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-levha-cizgi px-4 py-3">
              <p className="text-sm text-tebesir-soluk">Okumak serbest. Mesaj ve dosya göndermek için obaya katıl.</p>
              {sendError && <p className="w-full text-sm text-hata" role="alert">{sendError}</p>}
              <button type="button" onClick={joinPublic} disabled={joining} className="btn-ana">{joining ? 'Katılıyor…' : 'Obaya katıl'}</button>
            </div>
          ) : user ? (
            <form onSubmit={handleSendMessage}>
              {sendError && <p className="mb-2 text-sm text-hata" role="alert">{sendError}</p>}
              <div className="rounded-lg border border-levha-cizgi bg-levha-koyu focus-within:border-tebesir-silik transition-colors">
                {pendingFile && (
                  <div className="flex items-center gap-2 mx-2 mt-2 px-2.5 py-2 rounded-md bg-levha-yuzey">
                    <Paperclip className="w-4 h-4 shrink-0 text-tebesir-silik" aria-hidden="true" />
                    <span className="min-w-0 flex-1 text-sm text-tebesir truncate">{pendingFile.name}</span>
                    <span className="veri shrink-0">{formatSize(pendingFile.size)}</span>
                    <button type="button" onClick={() => setPendingFile(null)} className="p-1 text-tebesir-silik hover:text-tebesir" aria-label="Dosyayı kaldır">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
                <div className="flex items-center gap-1 p-1.5">
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
                    className="p-2 rounded-md text-tebesir-silik hover:text-tebesir hover:bg-levha-yuzey transition-colors"
                    title={`Dosya ekle (en fazla ${formatSize(MAX_FILE_SIZE)})`}
                    aria-label="Dosya ekle"
                  >
                    <Paperclip className="w-4 h-4" />
                  </button>
                  <label htmlFor="mesaj" className="sr-only">Mesaj</label>
                  <input
                    id="mesaj"
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    maxLength={2000}
                    autoComplete="off"
                    placeholder={pendingFile ? 'Dosyaya not ekle (isteğe bağlı)' : `#${activeChannel?.name ?? 'kanal'} kanalına yaz`}
                    className="flex-1 min-w-0 h-9 bg-transparent px-1 text-base text-tebesir placeholder:text-tebesir-silik focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={!newMessage.trim() && !pendingFile}
                    className="p-2 rounded-md text-isaret hover:bg-levha-yuzey disabled:text-tebesir-silik disabled:hover:bg-transparent transition-colors"
                    aria-label="Gönder"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </form>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-levha-cizgi px-4 py-3">
              <p className="text-sm text-tebesir-soluk">Okumak serbest; mesaj ve dosya göndermek için giriş yap.</p>
              <Link to="/auth" state={{ from: `/e-oba/${id}` }} className="btn-ikincil">Giriş yap</Link>
            </div>
          )}
        </div>

        {/* Paylaşılan dosyalar */}
        {showFiles && (
          <div className="absolute inset-y-0 right-0 z-20 w-full sm:w-80 bg-levha-yuzey border-l border-levha-cizgi flex flex-col">
            <div className="h-14 flex items-center justify-between px-4 border-b border-levha-cizgi shrink-0">
              <h3 className="text-sm font-semibold text-tebesir">Paylaşılan dosyalar</h3>
              <button type="button" onClick={() => setShowFiles(false)} className="p-1.5 rounded-md text-tebesir-silik hover:text-tebesir" aria-label="Paneli kapat">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {sharedFiles.length === 0 ? (
                <p className="px-3 py-8 text-sm text-center text-tebesir-silik">Bu kanalda henüz dosya paylaşılmadı.</p>
              ) : (
                <ul className="space-y-0.5">
                  {sharedFiles.map((m) => (
                    <li key={m.id}>
                      <button
                        type="button"
                        onClick={() =>
                          canPreview(m.file!)
                            ? setViewer({ messageId: m.id, file: m.file! })
                            : downloadObaFile(m.id, m.file!.name).catch((err) => console.error(err))
                        }
                        className="w-full flex items-center gap-3 px-2 py-2 rounded-md text-left hover:bg-levha transition-colors"
                      >
                        <FileTypeIcon file={m.file!} className="w-4 h-4 shrink-0 text-tebesir-silik" />
                        <span className="min-w-0">
                          <span className="block text-sm text-tebesir truncate">{m.file!.name}</span>
                          <span className="block text-xs text-tebesir-silik truncate">
                            {m.user.username} · {formatSize(m.file!.size)} · {new Date(m.createdAt).toLocaleDateString('tr-TR')}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </section>

      {toDelete && (
        <ConfirmDialog
          title="Mesaj silinsin mi?"
          confirmLabel="Sil"
          onClose={() => setToDelete(null)}
          onConfirm={async () => {
            await api(`/api/obamessages/message/${toDelete.id}`, { method: 'DELETE' });
            setMessages((prev) => prev.filter((m) => m.id !== toDelete.id));
          }}
        >
          {toDelete.file ? 'Mesaj ve eklenen dosya herkes için silinecek.' : 'Mesaj herkes için silinecek.'}
        </ConfirmDialog>
      )}

      {confirmLeave && (
        <ConfirmDialog
          title={`${obaName ?? 'Obadan'} ayrılınsın mı?`}
          confirmLabel="Ayrıl"
          onClose={() => setConfirmLeave(false)}
          onConfirm={async () => {
            await api(`/api/obalar/${id}/leave`, { method: 'POST' });
            forgetOba(user?.id, Number(id));
            navigate('/e-oba');
          }}
        >
          Mesajların obada kalır. Eklendiğin gizli kanallardan da çıkarsın; açık obaya istediğin zaman yeniden katılabilirsin.
        </ConfirmDialog>
      )}

      {channelForm && user && (
        <ChannelFormModal
          obaId={id!}
          userId={user.id}
          categories={textCategories}
          initialCategory={channelForm.category}
          channel={channelForm.channel}
          onClose={() => setChannelForm(null)}
          onSaved={(saved) => {
            setChannelForm(null);
            setSearchParams({ kanal: String(saved.id) }, { replace: true });
            // Düzenlenen kanal açıksa başlık ve kişiler tazelensin
            setActiveChannel((cur) => (cur?.id === saved.id ? { ...saved } : cur));
            fetchChannels(saved.id);
          }}
        />
      )}

      {channelToDelete && (
        <ConfirmDialog
          title={`#${channelToDelete.name} silinsin mi?`}
          confirmLabel="Kanalı sil"
          onClose={() => setChannelToDelete(null)}
          onConfirm={async () => {
            await api(`/api/obachannels/kanal/${channelToDelete.id}`, { method: 'DELETE' });
            setSearchParams({}, { replace: true });
            setActiveChannel(null);
            await fetchChannels();
          }}
        >
          Kanaldaki bütün mesajlar ve paylaşılan dosyalar herkes için silinecek. Bu geri alınamaz.
        </ConfirmDialog>
      )}

      {viewer && (
        <FileViewer messageId={viewer.messageId} file={viewer.file} onClose={() => setViewer(null)} />
      )}
    </div>
  );
}
