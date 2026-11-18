import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell } from 'lucide-react';
import * as signalR from '@microsoft/signalr';
import { API_URL, api, hubOptions } from '../../services/api';
import { NotificationItem } from '../../types';
import { fullDate, timeAgo } from '../../utils/time';

// Yeni bildirimler SignalR ile anında gelir; yoklama yalnızca bağlantı koparsa diye yedek
const POLL_MS = 5 * 60_000;

/** Üst menüdeki bildirim zili: okunmamış sayısı, açılır liste, hepsini okundu say. */
export default function NotificationBell() {
  const navigate = useNavigate();
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[] | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  const refreshCount = useCallback(() => {
    if (document.hidden) return;
    api<{ count: number }>('/api/notifications/unread-count').then((d) => setUnread(d.count)).catch(() => {});
  }, []);

  // Dakikada bir ve sekmeye dönüldüğünde sayıyı yenile
  useEffect(() => {
    refreshCount();
    const timer = window.setInterval(refreshCount, POLL_MS);
    document.addEventListener('visibilitychange', refreshCount);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', refreshCount);
    };
  }, [refreshCount]);

  // Canlı bildirimler
  useEffect(() => {
    const connection = new signalR.HubConnectionBuilder()
      .withUrl(`${API_URL}/notificationhub`, hubOptions) // kimlik oturum çerezinden
      .withAutomaticReconnect()
      // Geliştirmede StrictMode ilk bağlantıyı hemen kapatır; bu ve kopmalar sessiz geçsin (yoklama yedekte)
      .configureLogging(signalR.LogLevel.None)
      .build();
    connection.on('Bildirim', (n: NotificationItem) => {
      setUnread((c) => c + 1);
      setItems((prev) => (prev ? [n, ...prev.filter((x) => x.id !== n.id)] : prev));
    });
    connection.onreconnected(refreshCount); // kopukken gelenler sayıya eklensin
    connection.start().catch(() => {});
    return () => {
      connection.stop().catch(() => {});
    };
  }, [refreshCount]);

  // Okunmamış sayısı sekme başlığında: "(3) KaraLevha"
  useEffect(() => {
    const base = document.title.replace(/^\(\d+\+?\) /, '');
    document.title = unread > 0 ? `(${unread > 9 ? '9+' : unread}) ${base}` : base;
  }, [unread]);

  useEffect(() => {
    if (!open) return;
    api<NotificationItem[]>('/api/notifications').then(setItems).catch(() => setItems([]));
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const markAll = async () => {
    await api('/api/notifications/read', { method: 'POST' }).catch(() => {});
    setUnread(0);
    setItems((prev) => (prev ?? []).map((n) => ({ ...n, isRead: true })));
  };

  const go = (n: NotificationItem) => {
    setOpen(false);
    if (!n.isRead) {
      api(`/api/notifications/${n.id}/read`, { method: 'POST' }).catch(() => {});
      setUnread((c) => Math.max(0, c - 1));
      setItems((prev) => (prev ?? []).map((x) => (x.id === n.id ? { ...x, isRead: true } : x)));
    }
    navigate(n.link);
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={unread > 0 ? `Bildirimler, ${unread} okunmamış` : 'Bildirimler'}
        className="relative p-2 rounded-md text-tebesir-silik hover:text-tebesir hover:bg-levha-yuzey transition-colors"
      >
        <Bell className="w-[18px] h-[18px]" />
        {unread > 0 && (
          <span className="absolute top-1 right-1 min-w-4 h-4 px-1 rounded-full bg-isaret text-levha-koyu text-xs font-semibold leading-4 text-center" aria-hidden="true">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div role="dialog" aria-label="Bildirimler" className="absolute right-0 top-full mt-2 z-40 w-[min(22rem,calc(100vw-2rem))] rounded-lg border border-levha-cizgi bg-levha-yuzey shadow-2xl">
          <div className="flex items-center justify-between px-4 h-11 border-b border-levha-cizgi">
            <h2 className="text-sm font-semibold text-tebesir">Bildirimler</h2>
            {unread > 0 && <button type="button" onClick={markAll} className="text-xs text-tebesir-soluk hover:text-tebesir">Hepsini okundu say</button>}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {items === null ? (
              <p className="px-4 py-6 text-sm text-tebesir-silik">Yükleniyor…</p>
            ) : items.length === 0 ? (
              <p className="px-4 py-6 text-sm text-tebesir-silik text-center">Bildirimin yok. Biri yorum yaptığında, senden bahsettiğinde ya da etkinliğin değiştiğinde burada görünür.</p>
            ) : (
              <ul className="divide-y divide-levha-cizgi">
                {items.map((n) => (
                  <li key={n.id}>
                    <button type="button" onClick={() => go(n)} className="w-full flex gap-3 px-4 py-3 text-left hover:bg-levha transition-colors">
                      <span className={`mt-1.5 w-2 h-2 shrink-0 rounded-full ${n.isRead ? 'bg-transparent' : 'bg-isaret'}`} aria-hidden="true" />
                      <span className="min-w-0">
                        <span className={`block text-sm ${n.isRead ? 'text-tebesir-soluk' : 'text-tebesir'}`}>{n.text}</span>
                        <time dateTime={n.createdAt} title={fullDate(n.createdAt)} className="text-xs text-tebesir-silik">{timeAgo(n.createdAt)}</time>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
