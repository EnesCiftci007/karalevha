import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bell, Check, Loader2 } from 'lucide-react';
import { api } from '../../services/api';
import { Notification } from '../../types';
import { useAuth } from '../../context/AuthContext';

export default function NotificationsDropdown() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [show, setShow] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (unreadCount > 0) {
      document.title = `(${unreadCount}) KaraLevha`;
    } else {
      document.title = 'KaraLevha';
    }
  }, [unreadCount]);

  useEffect(() => {
    if (user) {
      fetchUnreadCount();
      const interval = setInterval(fetchUnreadCount, 60000);
      return () => clearInterval(interval);
    }
  }, [user]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShow(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchUnreadCount = async () => {
    try {
      const count = await api<number>('/api/notifications/unread-count');
      setUnreadCount(count);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const data = await api<Notification[]>('/api/notifications?take=20');
      setNotifications(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = () => {
    const nextState = !show;
    setShow(nextState);
    if (nextState) {
      fetchNotifications();
    }
  };

  const handleMarkAsRead = async (id: number) => {
    try {
      await api(`/api/notifications/${id}/read`, { method: 'PATCH' });
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error(err);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await api(`/api/notifications/read-all`, { method: 'PATCH' });
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error(err);
    }
  };

  const handleNotificationClick = (notif: Notification) => {
    if (!notif.isRead) {
      handleMarkAsRead(notif.id);
    }
    setShow(false);
    if (notif.postId) {
      navigate(`/akis`);
    }
  };

  const getNotificationText = (notif: Notification) => {
    if (notif.type === 'Like') return 'gönderini beğendi.';
    if (notif.type === 'Comment') return 'gönderine yorum yaptı.';
    if (notif.type === 'Reply') return 'yorumuna cevap verdi.';
    return 'bir etkileşimde bulundu.';
  };

  if (!user) return null;

  return (
    <div ref={dropdownRef} className="relative">
      <button 
        onClick={handleToggle}
        className="text-zinc-400 hover:text-white transition-colors relative"
      >
        <Bell className="w-6 h-6" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#ff0055] text-white text-[10px] font-bold flex items-center justify-center rounded-full border border-[#0b0c10]">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {show && (
        <div className="absolute top-full -right-2 sm:right-0 mt-2 w-[calc(100vw-2rem)] sm:w-96 max-w-[360px] bg-[#0b0c10] border-2 border-[#1f2129] shadow-[4px_4px_0px_rgba(0,229,255,0.2)] z-50 flex flex-col max-h-96">
          <div className="flex items-center justify-between p-3 border-b border-[#1f2129]">
            <span className="text-white font-black uppercase tracking-wider text-sm">Bildirimler</span>
            {unreadCount > 0 && (
              <button 
                onClick={handleMarkAllAsRead}
                className="text-[#00e5ff] text-xs font-bold hover:text-white flex items-center gap-1 transition-colors"
              >
                <Check className="w-3 h-3" /> Tümünü Okundu İşaretle
              </button>
            )}
          </div>
          
          <div className="overflow-y-auto flex-1 custom-scrollbar">
            {loading ? (
              <div className="flex justify-center p-6">
                <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
              </div>
            ) : notifications.length > 0 ? (
              <div className="flex flex-col">
                {notifications.map(notif => (
                  <div 
                    key={notif.id}
                    onClick={() => handleNotificationClick(notif)}
                    className={`flex items-start p-3 border-b border-[#1f2129] last:border-b-0 cursor-pointer transition-colors group ${!notif.isRead ? 'bg-[#ff5500]/10 hover:bg-[#ff5500]/20' : 'hover:bg-[#13151a]'}`}
                  >
                    <img 
                      src={`https://api.dicebear.com/7.x/bottts/svg?seed=${notif.actor.avatarSeed || notif.actor.username}&backgroundColor=transparent`}
                      alt={notif.actor.username}
                      className="w-10 h-10 bg-zinc-800 rounded-none border border-zinc-700 mr-3 flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] text-zinc-300">
                        <span className="text-white font-bold">{notif.actor.username}</span> {getNotificationText(notif)}
                      </p>
                      <span className="text-[10px] text-zinc-500 font-bold uppercase mt-1 block">
                        {new Date(notif.createdAt).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    {!notif.isRead && (
                      <div className="w-2 h-2 bg-[#ff5500] rounded-full mt-2 ml-2 flex-shrink-0"></div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-6 text-center text-zinc-500 text-[13px] font-bold">BİLDİRİM YOK</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}






