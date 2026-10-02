import React, { useState, useEffect, useRef } from 'react';
import { API_URL } from '../config';
import { useLanguage } from '../i18n/LanguageContext';

const PRIMARY_BLUE = '#0066ff';

export default function DMWidget({ user, activePartnerId, onCloseDM }) {
    const { t } = useLanguage();
    const [isOpen, setIsOpen] = useState(false);
    const [conversations, setConversations] = useState([]);
    const [activePartner, setActivePartner] = useState(null);
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [unreadTotal, setUnreadTotal] = useState(0);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);

    const messagesEndRef = useRef(null);

    // 1. Okunmamış DM Sayısını ve Sohbet Listesini Çek
    const loadConversations = async () => {
        if (!user?.id) return;
        try {
            const res = await fetch(`${API_URL}/api/dm/conversations?user_id=${user.id}`);
            if (res.ok) {
                const data = await res.json();
                setConversations(data || []);
                const total = (data || []).reduce((acc, c) => acc + (c.unread_count || 0), 0);
                setUnreadTotal(total);
            }
        } catch {
            // Sessizce geç
        }
    };

    // 2. Aktif Sohbetin Mesajlarını Çek
    const loadMessages = async (partnerId) => {
        if (!user?.id || !partnerId) return;
        try {
            const res = await fetch(`${API_URL}/api/dm/messages?user_id=${user.id}&partner_id=${partnerId}`);
            if (res.ok) {
                const data = await res.json();
                setMessages(data || []);
                loadConversations(); // Okundu işaretlendiği için sayacı güncelle
            }
        } catch {
            // Sessizce geç
        }
    };

    // Belirli bir kullanıcıyla sohbet başlat/aç
    const openChatWith = async (partner) => {
        setActivePartner(partner);
        setIsOpen(true);
        setSearchQuery('');
        setSearchResults([]);
        setIsSearching(false);
        loadMessages(partner.id || partner.partner_id);
    };

    // Dışarıdan gelen `activePartnerId` prop'u veya custom event dinleme
    useEffect(() => {
        if (activePartnerId && user?.id) {
            // Kullanıcı bilgilerini bul veya getir
            fetch(`${API_URL}/api/users/search?q=&current_user_id=${user.id}`)
                .then(r => r.json())
                .then(list => {
                    const found = list.find(u => u.id === activePartnerId);
                    if (found) {
                        openChatWith(found);
                    } else {
                        // Basit nesneyle aç
                        openChatWith({ id: activePartnerId, display_name: 'Maker', partner_id: activePartnerId });
                    }
                })
                .catch(() => {
                    openChatWith({ id: activePartnerId, display_name: 'Maker', partner_id: activePartnerId });
                });
        }
    }, [activePartnerId]);

    useEffect(() => {
        const handleCustomOpen = (e) => {
            if (e.detail?.partner) {
                openChatWith(e.detail.partner);
            }
        };
        const handleToggle = () => {
            setIsOpen(prev => !prev);
        };
        window.addEventListener('open-dm-chat', handleCustomOpen);
        window.addEventListener('toggle-dm-widget', handleToggle);
        return () => {
            window.removeEventListener('open-dm-chat', handleCustomOpen);
            window.removeEventListener('toggle-dm-widget', handleToggle);
        };
    }, []);

    // Polling: Sohbet listesi 5s'de bir, aktif sohbet ise 2.5s'de bir güncellenir
    useEffect(() => {
        if (!user?.id) return;
        loadConversations();

        const timer = setInterval(() => {
            loadConversations();
            if (activePartner) {
                loadMessages(activePartner.id || activePartner.partner_id);
            }
        }, 3000);

        return () => clearInterval(timer);
    }, [user?.id, activePartner]);

    // Mesajlar gelince aşağı kaydır
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Kullanıcı Arama
    useEffect(() => {
        if (!searchQuery.trim() || !user?.id) {
            setSearchResults([]);
            setIsSearching(false);
            return;
        }

        setIsSearching(true);
        const timer = setTimeout(async () => {
            try {
                const res = await fetch(`${API_URL}/api/users/search?q=${encodeURIComponent(searchQuery)}&current_user_id=${user.id}`);
                if (res.ok) {
                    const data = await res.json();
                    setSearchResults(data || []);
                }
            } catch {
                // Hata
            } finally {
                setIsSearching(false);
            }
        }, 300);

        return () => clearTimeout(timer);
    }, [searchQuery, user?.id]);

    // Mesaj Gönder
    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!newMessage.trim() || !activePartner || !user?.id) return;

        const targetId = activePartner.id || activePartner.partner_id;
        const msgText = newMessage.trim();
        setNewMessage('');

        try {
            const res = await fetch(`${API_URL}/api/dm/send`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sender_id: user.id,
                    receiver_id: targetId,
                    message: msgText
                })
            });

            if (res.ok) {
                loadMessages(targetId);
                loadConversations();
            }
        } catch {
            // Hata
        }
    };

    const renderMessageContent = (text) => {
        if (!text) return '';
        const urlRegex = /(https?:\/\/[^\s]+|\/e-oba\?[^\s]+)/g;
        const parts = text.split(urlRegex);
        if (parts.length === 1) return text;

        return parts.map((part, idx) => {
            if (part && (part.startsWith('http') || part.startsWith('/e-oba'))) {
                const isInternal = part.startsWith('/e-oba');
                const isObaInvite = part.includes('davet=') || part.includes('invite=');
                return (
                    <a
                        key={idx}
                        href={part}
                        style={{
                            color: '#60a5fa',
                            textDecoration: 'underline',
                            fontWeight: '600',
                            wordBreak: 'break-all'
                        }}
                        onClick={(e) => {
                            if (isInternal) {
                                e.preventDefault();
                                window.location.href = part;
                            }
                        }}
                    >
                        {isObaInvite ? ' [Obaya Katıl] ' : part}
                    </a>
                );
            }
            return part;
        });
    };

    if (!user || !isOpen) return null;

    return (
        <div style={styles.floatingContainer}>
            {/* AÇIK MESAJLAŞMA PENCERESİ */}
            <div style={styles.messengerBox}>
                {/* ÜST BAŞLIK BARI */}
                <div style={styles.messengerHeader}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                            {activePartner ? (
                                <>
                                    <button
                                        onClick={() => setActivePartner(null)}
                                        style={styles.backBtn}
                                        title="Sohbet Listesine Dön"
                                    >
                                        ◀
                                    </button>
                                    {activePartner.profile_image ? (
                                        <img src={activePartner.profile_image} alt="" style={styles.headerAvatar} />
                                    ) : (
                                        <div style={styles.headerAvatarPlaceholder}>👤</div>
                                    )}
                                    <div style={{ overflow: 'hidden' }}>
                                        <div style={styles.headerPartnerName}>{activePartner.display_name}</div>
                                        {activePartner.badge && (
                                            <span style={styles.headerBadge}>{activePartner.badge}</span>
                                        )}
                                    </div>
                                </>
                            ) : (
                                <>
                                    <span style={{ fontSize: '16px' }}>💬</span>
                                    <span style={styles.headerTitle}>{t('user_messages')}</span>
                                    {unreadTotal > 0 && (
                                        <span style={styles.headerBadge}>{unreadTotal} {t('user_unread')}</span>
                                    )}
                                </>
                            )}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <button
                                onClick={() => setIsOpen(false)}
                                style={styles.iconBtn}
                                title="—"
                            >
                                —
                            </button>
                            <button
                                onClick={() => {
                                    setIsOpen(false);
                                    setActivePartner(null);
                                    if (onCloseDM) onCloseDM();
                                }}
                                style={styles.iconBtn}
                                title={t('btn_close')}
                            >
                                ✕
                            </button>
                        </div>
                    </div>

                    {/* İÇERİK: YA SOHBET LİSTESİ YA DA AKTİF MESAJLAŞMA */}
                    {!activePartner ? (
                        /* GÖRÜNÜM 1: SOHBETLER LİSTESİ & KULLANICI ARAMA */
                        <div style={styles.conversationsView}>
                            {/* Arama Çubuğu */}
                            <div style={styles.searchBarWrapper}>
                                <input
                                    type="text"
                                    placeholder={`🔍 ${t('user_search_placeholder')}`}
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    style={styles.searchInput}
                                />
                            </div>

                            {/* Arama Sonuçları (Arama Yapılıyorsa) */}
                            {searchQuery.trim() ? (
                                <div style={styles.searchResultList}>
                                    <div style={styles.sectionHeader}>{t('user_search_placeholder')}</div>
                                    {isSearching ? (
                                        <div style={styles.noticeText}>{t('user_searching')}</div>
                                    ) : searchResults.length === 0 ? (
                                        <div style={styles.noticeText}>{t('user_not_found')}</div>
                                    ) : (
                                        searchResults.map(result => (
                                            <div
                                                key={result.id}
                                                onClick={() => openChatWith(result)}
                                                style={styles.conversationItem}
                                            >
                                                {result.profile_image ? (
                                                    <img src={result.profile_image} alt="" style={styles.partnerAvatar} />
                                                ) : (
                                                    <div style={styles.partnerAvatarPlaceholder}>👤</div>
                                                )}
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div style={styles.partnerName}>{result.display_name}</div>
                                                    <div style={styles.partnerEmail}>{result.email}</div>
                                                </div>
                                                <span style={styles.startChatTag}>Sohbet Et</span>
                                            </div>
                                        ))
                                    )}
                                </div>
                            ) : (
                                /* Normal Sohbet Listesi */
                                <div style={styles.conversationList}>
                                    {conversations.length === 0 ? (
                                        <div style={styles.emptyConversationsNotice}>
                                            <span style={{ fontSize: '32px' }}>💬</span>
                                            <p style={{ margin: '8px 0 4px 0', fontWeight: 'bold' }}>Henüz bir mesajlaşma yok</p>
                                            <span style={{ fontSize: '12px', color: '#71717a' }}>
                                                Yukarıdan bir maker arayarak ilk mesajı gönderebilirsiniz!
                                            </span>
                                        </div>
                                    ) : (
                                        conversations.map(conv => (
                                            <div
                                                key={conv.partner_id}
                                                onClick={() => openChatWith({
                                                    id: conv.partner_id,
                                                    display_name: conv.display_name,
                                                    profile_image: conv.profile_image,
                                                    badge: conv.badge
                                                })}
                                                style={{
                                                    ...styles.conversationItem,
                                                    backgroundColor: conv.unread_count > 0 ? 'rgba(0, 102, 255, 0.08)' : 'transparent'
                                                }}
                                            >
                                                {conv.profile_image ? (
                                                    <img src={conv.profile_image} alt="" style={styles.partnerAvatar} />
                                                ) : (
                                                    <div style={styles.partnerAvatarPlaceholder}>👤</div>
                                                )}

                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                        <span style={styles.partnerName}>{conv.display_name}</span>
                                                        <span style={styles.convTime}>
                                                            {conv.last_message_time ? parseUTC(conv.last_message_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                                                        </span>
                                                    </div>
                                                    <div style={styles.lastMessagePreview}>
                                                        {conv.last_sender_id === user.id ? 'Sen: ' : ''}
                                                        {conv.last_message || '...'}
                                                    </div>
                                                </div>

                                                {conv.unread_count > 0 && (
                                                    <span style={styles.convUnreadBadge}>{conv.unread_count}</span>
                                                )}
                                            </div>
                                        ))
                                    )}
                                </div>
                            )}
                        </div>
                    ) : (
                        /* GÖRÜNÜM 2: AKTİF SOHBET VE MESAJ AKIŞI */
                        <div style={styles.chatView}>
                            <div style={styles.messagesScrollArea}>
                                {messages.length === 0 ? (
                                    <div style={styles.chatEmptyNotice}>
                                        <p>👋 <strong>{activePartner.display_name}</strong> ile ilk mesajlaşmayı başlatın!</p>
                                    </div>
                                ) : (
                                    messages.map(msg => {
                                        const isMe = msg.sender_id === user.id;
                                        return (
                                            <div
                                                key={msg.id}
                                                style={{
                                                    ...styles.messageRow,
                                                    justifyContent: isMe ? 'flex-end' : 'flex-start'
                                                }}
                                            >
                                                <div
                                                    style={{
                                                        ...styles.messageBubble,
                                                        backgroundColor: isMe ? PRIMARY_BLUE : '#1c1c28',
                                                        color: '#fff',
                                                        borderRadius: isMe ? '14px 14px 2px 14px' : '14px 14px 14px 2px'
                                                    }}
                                                >
                                                    <div style={styles.messageText}>{renderMessageContent(msg.message)}</div>
                                                    <div style={{
                                                        ...styles.messageTime,
                                                        textAlign: isMe ? 'right' : 'left'
                                                    }}>
                                                        {parseUTC(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                                <div ref={messagesEndRef} />
                            </div>

                            {/* Mesaj Yazma Giriş Alanı */}
                            <form onSubmit={handleSendMessage} style={styles.inputContainer}>
                                <input
                                    type="text"
                                    placeholder={`${t('user_type_message')} (Enter)`}
                                    value={newMessage}
                                    onChange={(e) => setNewMessage(e.target.value)}
                                    style={styles.messageInput}
                                    autoFocus
                                />
                                <button
                                    type="submit"
                                    disabled={!newMessage.trim()}
                                    style={{
                                        ...styles.sendBtn,
                                        opacity: !newMessage.trim() ? 0.4 : 1
                                    }}
                                >
                                    ➤
                                </button>
                            </form>
                        </div>
                    )}
                </div>
        </div>
    );
}

const styles = {
    floatingContainer: {
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        zIndex: 99999,
        fontFamily: 'inherit'
    },
    floatingLauncherBtn: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        backgroundColor: '#111119',
        border: `1px solid ${PRIMARY_BLUE}`,
        color: '#fff',
        padding: '10px 18px',
        borderRadius: '30px',
        boxShadow: '0 8px 24px rgba(0, 102, 255, 0.35)',
        cursor: 'pointer',
        fontWeight: 'bold',
        fontSize: '14px',
        transition: 'transform 0.2s, box-shadow 0.2s'
    },
    launcherText: {
        fontSize: '13.5px'
    },
    launcherBadge: {
        backgroundColor: '#ef4444',
        color: '#fff',
        borderRadius: '10px',
        padding: '1px 6px',
        fontSize: '11px',
        fontWeight: 'bold',
        marginLeft: '2px'
    },
    messengerBox: {
        width: '360px',
        height: '480px',
        maxWidth: 'calc(100vw - 30px)',
        maxHeight: 'calc(100vh - 80px)',
        backgroundColor: '#101018',
        border: '1px solid #232338',
        borderRadius: '14px',
        boxShadow: '0 16px 40px rgba(0, 0, 0, 0.85)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        animation: 'fadeIn 0.15s ease-out'
    },
    messengerHeader: {
        padding: '12px 14px',
        backgroundColor: '#0c0c14',
        borderBottom: '1px solid #1a1a28',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
    },
    headerTitle: {
        fontWeight: 'bold',
        fontSize: '14px',
        color: '#fff'
    },
    headerBadge: {
        backgroundColor: 'rgba(0, 102, 255, 0.2)',
        color: '#3b82f6',
        fontSize: '10px',
        fontWeight: 'bold',
        padding: '2px 6px',
        borderRadius: '4px'
    },
    backBtn: {
        backgroundColor: 'transparent',
        border: 'none',
        color: '#3b82f6',
        cursor: 'pointer',
        fontSize: '14px',
        padding: '2px 6px'
    },
    headerAvatar: {
        width: '26px',
        height: '26px',
        borderRadius: '50%',
        objectFit: 'cover'
    },
    headerAvatarPlaceholder: {
        width: '26px',
        height: '26px',
        borderRadius: '50%',
        backgroundColor: '#272738',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '12px'
    },
    headerPartnerName: {
        fontWeight: 'bold',
        fontSize: '13px',
        color: '#fff',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        maxWidth: '160px'
    },
    iconBtn: {
        backgroundColor: 'transparent',
        border: 'none',
        color: '#888',
        cursor: 'pointer',
        fontSize: '14px',
        padding: '4px 6px'
    },
    conversationsView: {
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
    },
    searchBarWrapper: {
        padding: '10px 12px',
        backgroundColor: '#0e0e16',
        borderBottom: '1px solid #1a1a28'
    },
    searchInput: {
        width: '100%',
        backgroundColor: '#161624',
        border: '1px solid #28283d',
        borderRadius: '6px',
        padding: '7px 10px',
        color: '#fff',
        fontSize: '12.5px',
        outline: 'none',
        boxSizing: 'border-box'
    },
    sectionHeader: {
        padding: '8px 12px',
        fontSize: '11px',
        fontWeight: 'bold',
        color: '#71717a',
        backgroundColor: '#0c0c12'
    },
    noticeText: {
        padding: '16px',
        textAlign: 'center',
        fontSize: '12px',
        color: '#666'
    },
    searchResultList: {
        flex: 1,
        overflowY: 'auto'
    },
    conversationList: {
        flex: 1,
        overflowY: 'auto'
    },
    emptyConversationsNotice: {
        padding: '40px 20px',
        textAlign: 'center',
        color: '#94a3b8'
    },
    conversationItem: {
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '10px 12px',
        borderBottom: '1px solid #161622',
        cursor: 'pointer',
        transition: 'background-color 0.15s'
    },
    partnerAvatar: {
        width: '36px',
        height: '36px',
        borderRadius: '50%',
        objectFit: 'cover'
    },
    partnerAvatarPlaceholder: {
        width: '36px',
        height: '36px',
        borderRadius: '50%',
        backgroundColor: '#202030',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '16px'
    },
    partnerName: {
        fontWeight: '600',
        fontSize: '13px',
        color: '#fff'
    },
    partnerEmail: {
        fontSize: '11px',
        color: '#666'
    },
    convTime: {
        fontSize: '10px',
        color: '#666'
    },
    lastMessagePreview: {
        fontSize: '12px',
        color: '#94a3b8',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        marginTop: '2px'
    },
    convUnreadBadge: {
        backgroundColor: '#0066ff',
        color: '#fff',
        borderRadius: '10px',
        padding: '1px 6px',
        fontSize: '10px',
        fontWeight: 'bold'
    },
    startChatTag: {
        fontSize: '11px',
        color: '#3b82f6',
        backgroundColor: 'rgba(0, 102, 255, 0.15)',
        padding: '3px 8px',
        borderRadius: '4px',
        fontWeight: '600'
    },
    chatView: {
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
    },
    messagesScrollArea: {
        flex: 1,
        overflowY: 'auto',
        padding: '14px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px'
    },
    chatEmptyNotice: {
        textAlign: 'center',
        color: '#888',
        fontSize: '13px',
        marginTop: '40px'
    },
    messageRow: {
        display: 'flex'
    },
    messageBubble: {
        maxWidth: '75%',
        padding: '8px 12px',
        boxShadow: '0 2px 6px rgba(0, 0, 0, 0.3)'
    },
    messageText: {
        fontSize: '13px',
        lineHeight: '1.4',
        wordBreak: 'break-word',
        whiteSpace: 'pre-wrap'
    },
    messageTime: {
        fontSize: '9.5px',
        color: 'rgba(255, 255, 255, 0.6)',
        marginTop: '4px'
    },
    inputContainer: {
        padding: '8px 10px',
        backgroundColor: '#0c0c14',
        borderTop: '1px solid #1a1a28',
        display: 'flex',
        gap: '6px'
    },
    messageInput: {
        flex: 1,
        backgroundColor: '#161624',
        border: '1px solid #28283d',
        borderRadius: '8px',
        padding: '8px 12px',
        color: '#fff',
        fontSize: '13px',
        outline: 'none'
    },
    sendBtn: {
        backgroundColor: PRIMARY_BLUE,
        color: '#fff',
        border: 'none',
        borderRadius: '8px',
        padding: '0 14px',
        fontSize: '14px',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
    }
};
