import React, { useState, useEffect, useRef } from 'react';
import { API_URL } from '../config';
import { useLanguage } from '../i18n/LanguageContext';

export default function NotificationsDropdown({ user, onOpenDM }) {
    const { t } = useLanguage();
    const [isOpen, setIsOpen] = useState(false);
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const dropdownRef = useRef(null);

    const loadUnreadCount = async () => {
        if (!user?.id) return;
        try {
            const res = await fetch(`${API_URL}/api/notifications/unread_count?user_id=${user.id}`);
            if (res.ok) {
                const data = await res.json();
                setUnreadCount(data.unread_count || 0);
            }
        } catch {
            // Sessizce geç
        }
    };

    const loadNotifications = async () => {
        if (!user?.id) return;
        try {
            const res = await fetch(`${API_URL}/api/notifications?user_id=${user.id}`);
            if (res.ok) {
                const data = await res.json();
                setNotifications(data || []);
            }
        } catch {
            // Sessizce geç
        }
    };

    // Periyodik kontrol (5 saniyede bir)
    useEffect(() => {
        if (!user?.id) return;
        loadUnreadCount();
        const timer = setInterval(() => {
            loadUnreadCount();
            if (isOpen) loadNotifications();
        }, 5000);
        return () => clearInterval(timer);
    }, [user?.id, isOpen]);

    // Dışarı tıklandığında menüyü kapat
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const toggleDropdown = () => {
        const nextState = !isOpen;
        setIsOpen(nextState);
        if (nextState) {
            loadNotifications();
            loadUnreadCount();
        }
    };

    const handleMarkAllRead = async () => {
        if (!user?.id) return;
        try {
            await fetch(`${API_URL}/api/notifications/mark_all_read`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: user.id })
            });
            setUnreadCount(0);
            setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })));
        } catch {
            // Hata
        }
    };

    const handleNotificationClick = async (notif) => {
        try {
            await fetch(`${API_URL}/api/notifications/read/${notif.id}`, { method: 'POST' });
            setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, is_read: 1 } : n));
            loadUnreadCount();
        } catch {
            // Hata
        }

        setIsOpen(false);

        // DM bildirimi ise DM penceresini aç
        if (notif.type === 'dm' && notif.sender_id && onOpenDM) {
            onOpenDM(notif.sender_id);
        } else if (notif.link) {
            window.location.href = notif.link;
        }
    };

    if (!user) return null;

    return (
        <div style={styles.container} ref={dropdownRef}>
            <button
                onClick={toggleDropdown}
                style={styles.bellButton}
                className="nav-icon-btn"
                title={t('user_notifications')}
                aria-label={t('user_notifications')}
            >
                <span style={{ fontSize: '17px' }}>🔔</span>
                {unreadCount > 0 && (
                    <span style={styles.badge}>
                        {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                )}
            </button>

            {isOpen && (
                <div style={styles.dropdownMenu}>
                    <div style={styles.dropdownHeader}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontSize: '15px' }}>🔔</span>
                            <span style={styles.headerTitle}>{t('user_notifications')}</span>
                            {unreadCount > 0 && (
                                <span style={styles.headerUnreadPill}>{unreadCount} {t('user_new_notifications')}</span>
                            )}
                        </div>
                        {notifications.some(n => n.is_read === 0) && (
                            <button onClick={handleMarkAllRead} style={styles.markAllBtn}>
                                {t('user_mark_all_read')}
                            </button>
                        )}
                    </div>

                    <div style={styles.notifList}>
                        {notifications.length === 0 ? (
                            <div style={styles.emptyState}>
                                <span>🎉</span>
                                <p style={{ margin: '6px 0 0 0', fontSize: '13px' }}>{t('user_no_notifications')}</p>
                            </div>
                        ) : (
                            notifications.map((notif) => (
                                <div
                                    key={notif.id}
                                    onClick={() => handleNotificationClick(notif)}
                                    style={{
                                        ...styles.notifItem,
                                        backgroundColor: notif.is_read ? 'transparent' : 'rgba(0, 102, 255, 0.08)',
                                        borderLeft: notif.is_read ? '3px solid transparent' : '3px solid #0066ff'
                                    }}
                                >
                                    {notif.sender_avatar ? (
                                        <img src={notif.sender_avatar} alt="" style={styles.notifAvatar} />
                                    ) : (
                                        <div style={styles.notifIconBox}>
                                            {notif.type === 'dm' ? '💬' : '🔔'}
                                        </div>
                                    )}

                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={styles.notifTitle}>{notif.title}</div>
                                        <div style={styles.notifContent}>{notif.content}</div>
                                        <div style={styles.notifTime}>
                                            {parseUTC(notif.created_at).toLocaleString('tr-TR', {
                                                month: 'short',
                                                day: 'numeric',
                                                hour: '2-digit',
                                                minute: '2-digit'
                                            })}
                                        </div>
                                    </div>

                                    {!notif.is_read && (
                                        <div style={styles.unreadDot} />
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

const styles = {
    container: {
        position: 'relative',
        display: 'inline-block'
    },
    bellButton: {
        backgroundColor: 'rgba(255, 255, 255, 0.06)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '8px',
        width: '38px',
        height: '38px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        position: 'relative',
        transition: 'background-color 0.2s',
        color: '#fff'
    },
    badge: {
        position: 'absolute',
        top: '-4px',
        right: '-4px',
        backgroundColor: '#ef4444',
        color: '#fff',
        borderRadius: '10px',
        padding: '2px 5px',
        fontSize: '10px',
        fontWeight: 'bold',
        minWidth: '16px',
        textAlign: 'center',
        boxShadow: '0 2px 6px rgba(239, 68, 68, 0.5)'
    },
    dropdownMenu: {
        position: 'absolute',
        top: '46px',
        right: 0,
        width: '340px',
        backgroundColor: '#12121c',
        border: '1px solid #28283d',
        borderRadius: '12px',
        boxShadow: '0 12px 32px rgba(0, 0, 0, 0.8)',
        zIndex: 10000,
        overflow: 'hidden',
        animation: 'fadeIn 0.15s ease-out'
    },
    dropdownHeader: {
        padding: '12px 16px',
        backgroundColor: '#0d0d15',
        borderBottom: '1px solid #1f1f2e',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
    },
    headerTitle: {
        fontWeight: 'bold',
        fontSize: '14px',
        color: '#fff'
    },
    headerUnreadPill: {
        backgroundColor: 'rgba(0, 102, 255, 0.2)',
        color: '#3b82f6',
        fontSize: '11px',
        fontWeight: 'bold',
        padding: '2px 6px',
        borderRadius: '4px'
    },
    markAllBtn: {
        backgroundColor: 'transparent',
        border: 'none',
        color: '#3b82f6',
        fontSize: '11px',
        cursor: 'pointer',
        fontWeight: '600'
    },
    notifList: {
        maxHeight: '380px',
        overflowY: 'auto'
    },
    emptyState: {
        padding: '30px',
        textAlign: 'center',
        color: '#71717a',
        fontSize: '24px'
    },
    notifItem: {
        display: 'flex',
        alignItems: 'flex-start',
        gap: '10px',
        padding: '12px 14px',
        borderBottom: '1px solid #191924',
        cursor: 'pointer',
        transition: 'background-color 0.15s'
    },
    notifAvatar: {
        width: '34px',
        height: '34px',
        borderRadius: '50%',
        objectFit: 'cover',
        marginTop: '2px'
    },
    notifIconBox: {
        width: '34px',
        height: '34px',
        borderRadius: '50%',
        backgroundColor: '#1f1f2e',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '16px',
        marginTop: '2px'
    },
    notifTitle: {
        fontSize: '13px',
        fontWeight: 'bold',
        color: '#fff',
        marginBottom: '2px'
    },
    notifContent: {
        fontSize: '12px',
        color: '#94a3b8',
        lineHeight: '1.4',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap'
    },
    notifTime: {
        fontSize: '10px',
        color: '#666',
        marginTop: '4px'
    },
    unreadDot: {
        width: '8px',
        height: '8px',
        borderRadius: '50%',
        backgroundColor: '#0066ff',
        marginTop: '6px',
        flexShrink: 0
    }
};
