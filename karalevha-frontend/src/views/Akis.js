import React, { useState, useEffect, useRef, useMemo } from 'react';
import { API_URL } from '../config';
import { useLanguage } from '../i18n/LanguageContext';

// ----------------- SVG İKONLAR (Sade, Modern ve Emojisiz) -----------------
const HeartIcon = ({ filled, size = 18, color = 'currentColor' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? '#ef4444' : 'none'} stroke={filled ? '#ef4444' : color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
    </svg>
);

const CommentIcon = ({ size = 18, color = 'currentColor' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
    </svg>
);

const RepostIcon = ({ size = 18, color = 'currentColor' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="17 1 21 5 17 9"></polyline>
        <path d="M3 11V9a4 4 0 0 1 4-4h14"></path>
        <polyline points="7 23 3 19 7 15"></polyline>
        <path d="M21 13v2a4 4 0 0 1-4 4H3"></path>
    </svg>
);

const BookmarkIcon = ({ filled, size = 18, color = 'currentColor' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? '#38bdf8' : 'none'} stroke={filled ? '#38bdf8' : color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
    </svg>
);

const ShareIcon = ({ size = 18, color = 'currentColor' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="18" cy="5" r="3"></circle>
        <circle cx="6" cy="12" r="3"></circle>
        <circle cx="18" cy="19" r="3"></circle>
        <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
        <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
    </svg>
);

const ImageIcon = ({ size = 18, color = 'currentColor' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
        <circle cx="8.5" cy="8.5" r="1.5"></circle>
        <polyline points="21 15 16 10 5 21"></polyline>
    </svg>
);

const PollIcon = ({ size = 18, color = 'currentColor' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10"></line>
        <line x1="12" y1="20" x2="12" y2="4"></line>
        <line x1="6" y1="20" x2="6" y2="14"></line>
    </svg>
);

const SearchIcon = ({ size = 16, color = 'currentColor' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8"></circle>
        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
    </svg>
);

const TrashIcon = ({ size = 16, color = 'currentColor' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="3 6 5 6 21 6"></polyline>
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
    </svg>
);

const CloseIcon = ({ size = 16, color = 'currentColor' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
    </svg>
);

// Göreli Zaman Fonksiyonu
function formatRelativeTime(dateString) {
    if (!dateString) return '';
    const now = new Date();
    const then = new Date(dateString);
    const diffInSeconds = Math.floor((now - then) / 1000);

    if (diffInSeconds < 60) return 'az önce';
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) return `${diffInMinutes} dk`;
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours} sa`;
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 30) return `${diffInDays} g`;
    const diffInMonths = Math.floor(diffInDays / 30);
    if (diffInMonths < 12) return `${diffInMonths} ay`;
    return `${Math.floor(diffInMonths / 12)} yıl`;
}

export default function Akis() {
    const { t } = useLanguage();
    const [posts, setPosts] = useState([]);
    const [loading, setLoading] = useState(true);

    // Filtreleme ve Arama State'leri
    const [activeTab, setActiveTab] = useState('all'); // 'all', 'top', 'media', 'bookmarks'
    const [searchQuery, setSearchQuery] = useState('');

    // Yeni Gönderi State'leri
    const [content, setContent] = useState('');
    const [selectedFiles, setSelectedFiles] = useState([]); // Up to 4 files
    const [filePreviews, setFilePreviews] = useState([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');

    // Anket Oluşturma State'i
    const [showPollForm, setShowPollForm] = useState(false);
    const [pollQuestion, setPollQuestion] = useState('');
    const [pollOptions, setPollOptions] = useState(['', '']);

    // Alıntı / Repost Modal State'i
    const [quoteModalPost, setQuoteModalPost] = useState(null);
    const [quoteText, setQuoteText] = useState('');

    // Yorum State'leri
    const [expandedComments, setExpandedComments] = useState({});
    const [commentsMap, setCommentsMap] = useState({});
    const [commentInputs, setCommentInputs] = useState({});
    const [replyingTo, setReplyingTo] = useState({});

    // Görsel Büyütme (Lightbox) Modal State'i
    const [lightboxImage, setLightboxImage] = useState(null);

    // Mini Profil Kartı State'i
    const [miniProfileUser, setMiniProfileUser] = useState(null);
    const [miniProfileData, setMiniProfileData] = useState(null);
    const [miniProfilePos, setMiniProfilePos] = useState({ x: 0, y: 0 });

    // Toast Bildirim State'i
    const [toastMessage, setToastMessage] = useState('');

    const storedUser = localStorage.getItem('user');
    const user = storedUser ? JSON.parse(storedUser) : null;
    const fileInputRef = useRef(null);

    // Akışı Yükle
    const loadFeed = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            params.append('filter', activeTab);
            if (searchQuery.trim()) params.append('search', searchQuery.trim());
            if (user?.id) params.append('user_id', user.id);

            const res = await fetch(`${API_URL}/api/feed/posts?${params.toString()}`);
            const data = await res.json();
            if (Array.isArray(data)) {
                setPosts(data);
            }
        } catch (err) {
            console.error("Akış yüklenemedi:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadFeed();
    }, [activeTab, searchQuery]);

    const showToast = (msg) => {
        setToastMessage(msg);
        setTimeout(() => setToastMessage(''), 2500);
    };

    // Çoklu Fotoğraf Seçimi (En fazla 4)
    const handleFilesSelect = (e) => {
        const files = Array.from(e.target.files);
        if (!files.length) return;

        const remainingSlots = 4 - selectedFiles.length;
        const validFiles = files.slice(0, remainingSlots);

        const newSelected = [...selectedFiles, ...validFiles];
        setSelectedFiles(newSelected);

        const newPreviews = [];
        newSelected.forEach(file => {
            const reader = new FileReader();
            reader.onloadend = () => {
                newPreviews.push(reader.result);
                if (newPreviews.length === newSelected.length) {
                    setFilePreviews([...newPreviews]);
                }
            };
            reader.readAsDataURL(file);
        });
    };

    const handleRemoveFile = (index) => {
        const updatedFiles = selectedFiles.filter((_, i) => i !== index);
        const updatedPreviews = filePreviews.filter((_, i) => i !== index);
        setSelectedFiles(updatedFiles);
        setFilePreviews(updatedPreviews);
    };

    // Anket Seçeneği Ekle / Çıkar
    const handleAddPollOption = () => {
        if (pollOptions.length < 4) {
            setPollOptions([...pollOptions, '']);
        }
    };

    const handlePollOptionChange = (idx, value) => {
        const updated = [...pollOptions];
        updated[idx] = value;
        setPollOptions(updated);
    };

    const handleRemovePollOption = (idx) => {
        if (pollOptions.length > 2) {
            setPollOptions(pollOptions.filter((_, i) => i !== idx));
        }
    };

    // Yeni Gönderi Paylaşımı
    const handleCreatePost = async (e) => {
        e.preventDefault();
        if (!user) {
            setError(t('profile_please_login') || 'Lütfen giriş yapın.');
            return;
        }

        const hasText = content.trim().length > 0;
        const hasFiles = selectedFiles.length > 0;
        const hasPoll = showPollForm && pollQuestion.trim() && pollOptions.filter(o => o.trim()).length >= 2;

        if (!hasText && !hasFiles && !hasPoll) {
            setError(t('feed_fill_fields_err') || 'Lütfen bir metin yazın veya içerik ekleyin.');
            return;
        }

        setIsSubmitting(true);
        setError('');

        const formData = new FormData();
        formData.append('user_id', user.id);
        formData.append('content', content);

        selectedFiles.forEach(f => {
            formData.append('files', f);
        });

        if (showPollForm && pollQuestion.trim()) {
            const validOptions = pollOptions.map(o => o.trim()).filter(Boolean);
            if (validOptions.length >= 2) {
                formData.append('poll_question', pollQuestion.trim());
                formData.append('poll_options', JSON.stringify(validOptions));
            }
        }

        try {
            const res = await fetch(`${API_URL}/api/feed/posts`, {
                method: 'POST',
                body: formData
            });
            const data = await res.json();
            if (data.status === 'success') {
                setContent('');
                setSelectedFiles([]);
                setFilePreviews([]);
                setShowPollForm(false);
                setPollQuestion('');
                setPollOptions(['', '']);
                loadFeed();
            } else {
                setError(data.detail || 'Paylaşım yapılamadı.');
            }
        } catch (err) {
            setError('Sunucu ile iletişimde hata oluştu.');
        } finally {
            setIsSubmitting(false);
        }
    };

    // Alıntı Yaparak Paylaş (Quote Post)
    const handleCreateQuotePost = async () => {
        if (!user || !quoteModalPost) return;
        setIsSubmitting(true);

        const formData = new FormData();
        formData.append('user_id', user.id);
        formData.append('content', quoteText.trim());
        formData.append('repost_of_id', quoteModalPost.id);

        try {
            const res = await fetch(`${API_URL}/api/feed/posts`, {
                method: 'POST',
                body: formData
            });
            const data = await res.json();
            if (data.status === 'success') {
                setQuoteModalPost(null);
                setQuoteText('');
                showToast('Paylaşıldı');
                loadFeed();
            }
        } catch (err) {
            console.error("Alıntı paylaşılamadı:", err);
        } finally {
            setIsSubmitting(false);
        }
    };

    // Beğeni Butonu (Optimistic Update)
    const handleToggleLike = async (post) => {
        if (!user) {
            showToast('Beğenmek için giriş yapmalısınız');
            return;
        }

        const prevLiked = post.is_liked;
        const prevCount = post.likes_count || 0;

        // Optimistic UI
        setPosts(prev => prev.map(p => {
            if (p.id === post.id) {
                return {
                    ...p,
                    is_liked: !prevLiked,
                    likes_count: prevLiked ? Math.max(0, prevCount - 1) : prevCount + 1
                };
            }
            return p;
        }));

        try {
            await fetch(`${API_URL}/api/feed/posts/${post.id}/like`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: user.id })
            });
        } catch (err) {
            // Revert on error
            setPosts(prev => prev.map(p => p.id === post.id ? { ...p, is_liked: prevLiked, likes_count: prevCount } : p));
        }
    };

    // Yer İmleri (Bookmarks)
    const handleToggleBookmark = async (post) => {
        if (!user) {
            showToast('Kaydetmek için giriş yapmalısınız');
            return;
        }

        const prevBookmarked = post.is_bookmarked;
        setPosts(prev => prev.map(p => {
            if (p.id === post.id) {
                return { ...p, is_bookmarked: !prevBookmarked };
            }
            return p;
        }));

        showToast(!prevBookmarked ? 'Kaydedilenlere eklendi' : 'Kaydedilenlerden çıkarıldı');

        try {
            await fetch(`${API_URL}/api/feed/posts/${post.id}/bookmark`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: user.id })
            });
        } catch (err) {
            setPosts(prev => prev.map(p => p.id === post.id ? { ...p, is_bookmarked: prevBookmarked } : p));
        }
    };

    // Anket Oylama
    const handleVotePoll = async (pollId, optionIndex) => {
        if (!user) {
            showToast('Oy kullanmak için giriş yapmalısınız');
            return;
        }

        try {
            const res = await fetch(`${API_URL}/api/feed/polls/${pollId}/vote`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: user.id, option_index: optionIndex })
            });
            if (res.ok) {
                loadFeed();
            }
        } catch (err) {
            console.error("Oy kaydedilemedi:", err);
        }
    };

    // Bağlantıyı Kopyala (Share)
    const handleCopyPostLink = (postId) => {
        const link = `${window.location.origin}/akis?post=${postId}`;
        navigator.clipboard.writeText(link);
        showToast('Bağlantı kopyalandı');
    };

    // Gönderi Silme
    const handleDeletePost = async (postId) => {
        if (!user || !window.confirm('Bu gönderiyi silmek istediğinizden emin misiniz?')) return;
        try {
            const res = await fetch(`${API_URL}/api/feed/posts/${postId}?user_id=${user.id}`, {
                method: 'DELETE'
            });
            if (res.ok) {
                setPosts(prev => prev.filter(p => p.id !== postId));
                showToast('Gönderi silindi');
            }
        } catch (err) {
            console.error("Gönderi silinemedi:", err);
        }
    };

    // Yorumları Aç / Kapat
    const toggleComments = async (postId) => {
        const isOpen = expandedComments[postId];
        setExpandedComments(prev => ({ ...prev, [postId]: !isOpen }));

        if (!isOpen && !commentsMap[postId]) {
            try {
                const res = await fetch(`${API_URL}/api/feed/posts/${postId}/comments`);
                const data = await res.json();
                if (Array.isArray(data)) {
                    setCommentsMap(prev => ({ ...prev, [postId]: data }));
                }
            } catch (err) {
                console.error("Yorumlar alınamadı:", err);
            }
        }
    };

    // Yorum Gönderme
    const handleSendComment = async (postId) => {
        if (!user) return;
        const text = commentInputs[postId];
        if (!text || !text.trim()) return;

        const replyInfo = replyingTo[postId];
        const newComment = {
            post_id: postId,
            user_id: user.id,
            content: text.trim(),
            parent_id: replyInfo ? replyInfo.commentId : null
        };

        try {
            const res = await fetch(`${API_URL}/api/feed/comments`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newComment)
            });
            const data = await res.json();
            if (data.status === 'success') {
                setCommentInputs(prev => ({ ...prev, [postId]: '' }));
                setReplyingTo(prev => ({ ...prev, [postId]: null }));
                // Yorumları güncelle
                const commentsRes = await fetch(`${API_URL}/api/feed/posts/${postId}/comments`);
                const commentsData = await commentsRes.json();
                if (Array.isArray(commentsData)) {
                    setCommentsMap(prev => ({ ...prev, [postId]: commentsData }));
                }
                // Post yorum sayısını artır
                setPosts(prev => prev.map(p => p.id === postId ? { ...p, comments_count: (p.comments_count || 0) + 1 } : p));
            }
        } catch (err) {
            console.error("Yorum gönderilemedi:", err);
        }
    };

    // Mini Profil Aç
    const handleShowMiniProfile = async (authorId, e) => {
        e.stopPropagation();
        const rect = e.currentTarget.getBoundingClientRect();
        setMiniProfilePos({ x: rect.left, y: rect.bottom + window.scrollY + 8 });
        setMiniProfileUser(authorId);
        try {
            const res = await fetch(`${API_URL}/api/user/${authorId}/mini_profile`);
            if (res.ok) {
                const data = await res.json();
                setMiniProfileData(data);
            }
        } catch {
            // Sessizce geç
        }
    };

    // Metin içindeki #Hashtag ve @Mentions'ı tıklanabilir hale getiren parser
    const renderParsedContent = (text) => {
        if (!text) return null;
        const words = text.split(/(\s+)/);
        return words.map((part, idx) => {
            if (part.startsWith('#') && part.length > 1) {
                const tag = part.slice(1);
                return (
                    <span
                        key={idx}
                        onClick={(e) => {
                            e.stopPropagation();
                            setSearchQuery(`#${tag}`);
                        }}
                        style={styles.hashtag}
                    >
                        {part}
                    </span>
                );
            }
            if (part.startsWith('@') && part.length > 1) {
                return (
                    <span key={idx} style={styles.mention}>
                        {part}
                    </span>
                );
            }
            return part;
        });
    };

    // 1-4 Görsel Grid Renderlayıcı (Twitter/Threads tarzı)
    const renderImagesGrid = (images) => {
        if (!images || !images.length) return null;

        const count = images.length;
        return (
            <div style={{ ...styles.imageGrid, ...getImageGridLayout(count) }}>
                {images.map((imgUrl, i) => (
                    <div
                        key={i}
                        style={{ ...styles.imageGridItem, ...getImageGridItemStyle(count, i) }}
                        onClick={() => setLightboxImage(imgUrl)}
                    >
                        <img src={imgUrl} alt={`Upload ${i + 1}`} style={styles.gridImage} />
                    </div>
                ))}
            </div>
        );
    };

    return (
        <div style={styles.container} onClick={() => setMiniProfileUser(null)}>
            <div style={styles.feedWrapper}>
                {/* TOAST BİLDİRİM */}
                {toastMessage && (
                    <div style={styles.toast}>
                        {toastMessage}
                    </div>
                )}

                {/* ÜST BAR: BAŞLIK, ARAMA VE SEKME MENÜSÜ */}
                <div style={styles.header}>
                    <div style={styles.headerTop}>
                        <h1 style={styles.title}>{t('feed_title') || 'Akış'}</h1>

                        {/* Akış İçi Arama Çubuğu */}
                        <div style={styles.searchBox}>
                            <SearchIcon size={14} color="#888" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Akışta veya #etiketlerde ara..."
                                style={styles.searchInput}
                            />
                            {searchQuery && (
                                <button onClick={() => setSearchQuery('')} style={styles.clearSearchBtn}>
                                    <CloseIcon size={12} color="#888" />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Sekmeler (Tümü, En Beğenilenler, Kaydedilenler) */}
                    <div style={styles.tabsContainer}>
                        <button
                            onClick={() => setActiveTab('all')}
                            style={{ ...styles.tabBtn, borderBottom: activeTab === 'all' ? '2px solid #fff' : '2px solid transparent', color: activeTab === 'all' ? '#fff' : '#888' }}
                        >
                            Tümü
                        </button>
                        <button
                            onClick={() => setActiveTab('top')}
                            style={{ ...styles.tabBtn, borderBottom: activeTab === 'top' ? '2px solid #fff' : '2px solid transparent', color: activeTab === 'top' ? '#fff' : '#888' }}
                        >
                            En Beğenilenler
                        </button>
                        {user && (
                            <button
                                onClick={() => setActiveTab('bookmarks')}
                                style={{ ...styles.tabBtn, borderBottom: activeTab === 'bookmarks' ? '2px solid #fff' : '2px solid transparent', color: activeTab === 'bookmarks' ? '#fff' : '#888' }}
                            >
                                Kaydedilenler
                            </button>
                        )}
                    </div>
                </div>

                {/* YENİ GÖNDERİ OLUŞTURMA ALANI */}
                {user ? (
                    <div style={styles.createCard}>
                        <div style={styles.createHeader}>
                            <div style={styles.avatar}>
                                {user.profile_image ? (
                                    <img src={user.profile_image} alt="" style={styles.avatarImg} />
                                ) : (
                                    <span>{(user.display_name || user.email || 'U')[0].toUpperCase()}</span>
                                )}
                            </div>
                            <div style={{ flex: 1 }}>
                                <span style={styles.createUserName}>{user.display_name || user.email}</span>
                                <span style={styles.userBadge}>{user.badge || 'Maker'}</span>
                            </div>
                        </div>

                        {error && <div style={styles.errorBanner}>{error}</div>}

                        <form onSubmit={handleCreatePost}>
                            <textarea
                                value={content}
                                onChange={(e) => setContent(e.target.value)}
                                placeholder="Neler oluyor? Bir soru, fikir veya projenizi paylaşın..."
                                style={styles.textarea}
                                rows={3}
                            />

                            {/* Fotoğraf Önizlemeleri (1-4 Görsel) */}
                            {filePreviews.length > 0 && (
                                <div style={styles.previewsRow}>
                                    {filePreviews.map((preview, i) => (
                                        <div key={i} style={styles.previewBox}>
                                            <img src={preview} alt="Upload preview" style={styles.previewThumb} />
                                            <button type="button" onClick={() => handleRemoveFile(i)} style={styles.removePreviewBtn}>
                                                <CloseIcon size={12} color="#fff" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Anket Oluşturma Kutusu */}
                            {showPollForm && (
                                <div style={styles.pollFormContainer}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                        <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#888' }}>Anket Sorusu ve Seçenekleri</span>
                                        <button type="button" onClick={() => setShowPollForm(false)} style={styles.closePollBtn}>
                                            <CloseIcon size={12} color="#888" />
                                        </button>
                                    </div>
                                    <input
                                        type="text"
                                        value={pollQuestion}
                                        onChange={(e) => setPollQuestion(e.target.value)}
                                        placeholder="Soru yazın..."
                                        style={styles.pollInput}
                                    />
                                    {pollOptions.map((opt, idx) => (
                                        <div key={idx} style={{ display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '6px' }}>
                                            <input
                                                type="text"
                                                value={opt}
                                                onChange={(e) => handlePollOptionChange(idx, e.target.value)}
                                                placeholder={`Seçenek ${idx + 1}`}
                                                style={styles.pollInput}
                                            />
                                            {pollOptions.length > 2 && (
                                                <button type="button" onClick={() => handleRemovePollOption(idx)} style={styles.pollOptionRemoveBtn}>
                                                    <CloseIcon size={12} color="#888" />
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                    {pollOptions.length < 4 && (
                                        <button type="button" onClick={handleAddPollOption} style={styles.addPollOptionBtn}>
                                            + Seçenek Ekle
                                        </button>
                                    )}
                                </div>
                            )}

                            {/* Butonlar */}
                            <div style={styles.createFooter}>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <label style={styles.actionToolBtn} title="Görsel Ekle (En fazla 4)">
                                        <ImageIcon size={16} color="#aaa" />
                                        <span style={styles.actionToolText}>Görsel</span>
                                        <input
                                            ref={fileInputRef}
                                            type="file"
                                            accept="image/*"
                                            multiple
                                            onChange={handleFilesSelect}
                                            style={{ display: 'none' }}
                                        />
                                    </label>

                                    <button
                                        type="button"
                                        onClick={() => setShowPollForm(!showPollForm)}
                                        style={{
                                            ...styles.actionToolBtn,
                                            backgroundColor: showPollForm ? '#1f2937' : '#181824'
                                        }}
                                        title="Anket Ekle"
                                    >
                                        <PollIcon size={16} color="#aaa" />
                                        <span style={styles.actionToolText}>Anket</span>
                                    </button>
                                </div>

                                <button
                                    type="submit"
                                    disabled={isSubmitting || (!content.trim() && !selectedFiles.length && !pollQuestion.trim())}
                                    style={{
                                        ...styles.publishBtn,
                                        opacity: (isSubmitting || (!content.trim() && !selectedFiles.length && !pollQuestion.trim())) ? 0.4 : 1,
                                        cursor: (isSubmitting || (!content.trim() && !selectedFiles.length && !pollQuestion.trim())) ? 'not-allowed' : 'pointer'
                                    }}
                                >
                                    {isSubmitting ? 'Paylaşılıyor...' : 'Paylaş'}
                                </button>
                            </div>
                        </form>
                    </div>
                ) : (
                    <div style={styles.guestNotice}>
                        <span>Paylaşım yapmak veya etkileşimde bulunmak için giriş yapmalısınız.</span>
                        <a href="/giris" style={styles.guestLoginBtn}>{t('nav_login') || 'Giriş Yap'}</a>
                    </div>
                )}

                {/* AKIŞ LİSTESİ */}
                {loading ? (
                    <div style={styles.loadingContainer}>
                        <p style={{ color: '#888', fontSize: '14px' }}>Akış yükleniyor...</p>
                    </div>
                ) : posts.length === 0 ? (
                    <div style={styles.emptyState}>
                        <p style={{ color: '#aaa', fontSize: '15px', margin: 0 }}>
                            {activeTab === 'bookmarks' ? 'Henüz kaydedilmiş bir gönderiniz yok.' : 'Henüz paylaşım bulunamadı.'}
                        </p>
                    </div>
                ) : (
                    <div style={styles.postsList}>
                        {posts.map((post) => {
                            const isOwner = user && (user.id === post.user_id || user.role === 'admin');
                            const isCommentsOpen = expandedComments[post.id];
                            const comments = commentsMap[post.id] || [];

                            return (
                                <div key={post.id} style={styles.postCard}>
                                    {/* Gönderi Üst Bilgisi */}
                                    <div style={styles.postHeader}>
                                        <div
                                            style={styles.authorClickable}
                                            onClick={(e) => handleShowMiniProfile(post.user_id, e)}
                                        >
                                            <div style={styles.avatarSmall}>
                                                {post.profile_image ? (
                                                    <img src={post.profile_image} alt="" style={styles.avatarImg} />
                                                ) : (
                                                    <span>{(post.display_name || 'U')[0].toUpperCase()}</span>
                                                )}
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <span style={styles.postAuthorName}>{post.display_name}</span>
                                                    {post.badge && <span style={styles.postBadge}>{post.badge}</span>}
                                                </div>
                                                <span style={styles.postRelativeTime}>
                                                    {formatRelativeTime(post.tarih)}
                                                </span>
                                            </div>
                                        </div>

                                        {isOwner && (
                                            <button
                                                onClick={() => handleDeletePost(post.id)}
                                                style={styles.deletePostBtn}
                                                title="Sil"
                                            >
                                                <TrashIcon size={14} color="#888" />
                                            </button>
                                        )}
                                    </div>

                                    {/* Gönderi Metni */}
                                    <div style={styles.postBody}>
                                        {post.content && (
                                            <p style={styles.postText}>{renderParsedContent(post.content)}</p>
                                        )}

                                        {/* 1-4 Görsel Izgarası */}
                                        {post.images && post.images.length > 0 && renderImagesGrid(post.images)}

                                        {/* Anket Görünümü */}
                                        {post.poll && (
                                            <div style={styles.pollContainer}>
                                                <div style={styles.pollQuestion}>{post.poll.question}</div>
                                                <div style={styles.pollOptionsList}>
                                                    {post.poll.options.map((opt) => {
                                                        const isSelected = post.poll.user_voted === opt.index;
                                                        const hasVoted = post.poll.user_voted !== null && post.poll.user_voted !== undefined;

                                                        return (
                                                            <div
                                                                key={opt.index}
                                                                onClick={() => !hasVoted && handleVotePoll(post.poll.id, opt.index)}
                                                                style={{
                                                                    ...styles.pollOptionBar,
                                                                    cursor: hasVoted ? 'default' : 'pointer',
                                                                    borderColor: isSelected ? '#38bdf8' : '#27273a'
                                                                }}
                                                            >
                                                                {hasVoted && (
                                                                    <div
                                                                        style={{
                                                                            ...styles.pollFillBar,
                                                                            width: `${opt.percentage}%`,
                                                                            backgroundColor: isSelected ? 'rgba(56, 189, 248, 0.25)' : 'rgba(255, 255, 255, 0.08)'
                                                                        }}
                                                                    />
                                                                )}
                                                                <div style={styles.pollOptionContent}>
                                                                    <span style={{ fontWeight: isSelected ? 'bold' : 'normal', color: isSelected ? '#38bdf8' : '#fff' }}>
                                                                        {opt.text}
                                                                    </span>
                                                                    {hasVoted && (
                                                                        <span style={styles.pollPercentage}>
                                                                            %{opt.percentage}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                                <span style={styles.pollTotalVotes}>
                                                    {post.poll.total_votes} oy
                                                </span>
                                            </div>
                                        )}

                                        {/* Alıntılanan / Repost Gönderi Kartı */}
                                        {post.repost_of && (
                                            <div style={styles.repostCard}>
                                                <div style={styles.repostHeader}>
                                                    <span style={styles.repostAuthor}>{post.repost_of.display_name}</span>
                                                    <span style={styles.repostTime}>{formatRelativeTime(post.repost_of.tarih)}</span>
                                                </div>
                                                <p style={styles.repostContent}>{renderParsedContent(post.repost_of.content)}</p>
                                                {post.repost_of.images && post.repost_of.images.length > 0 && (
                                                    <img src={post.repost_of.images[0]} alt="" style={styles.repostImage} onClick={() => setLightboxImage(post.repost_of.images[0])} />
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {/* ETKİLEŞİM AKSİYONLARI (Twitter Tarzı İkon Butonları) */}
                                    <div style={styles.postActionsRow}>
                                        {/* 1. Beğeni Butonu */}
                                        <button
                                            onClick={() => handleToggleLike(post)}
                                            style={{
                                                ...styles.actionBtn,
                                                color: post.is_liked ? '#ef4444' : '#888'
                                            }}
                                            title="Beğen"
                                        >
                                            <HeartIcon filled={post.is_liked} size={16} />
                                            <span style={styles.actionCount}>{post.likes_count || 0}</span>
                                        </button>

                                        {/* 2. Yorum Butonu */}
                                        <button
                                            onClick={() => toggleComments(post.id)}
                                            style={{
                                                ...styles.actionBtn,
                                                color: isCommentsOpen ? '#38bdf8' : '#888'
                                            }}
                                            title="Yorumlar"
                                        >
                                            <CommentIcon size={16} />
                                            <span style={styles.actionCount}>{post.comments_count || 0}</span>
                                        </button>

                                        {/* 3. Alıntı Yap / Repost */}
                                        <button
                                            onClick={() => setQuoteModalPost(post)}
                                            style={styles.actionBtn}
                                            title="Alıntıla ve Paylaş"
                                        >
                                            <RepostIcon size={16} />
                                            <span style={styles.actionCount}>{post.reposts_count || 0}</span>
                                        </button>

                                        {/* 4. Yer İmleri / Kaydet */}
                                        <button
                                            onClick={() => handleToggleBookmark(post)}
                                            style={{
                                                ...styles.actionBtn,
                                                color: post.is_bookmarked ? '#38bdf8' : '#888'
                                            }}
                                            title="Kaydet"
                                        >
                                            <BookmarkIcon filled={post.is_bookmarked} size={16} />
                                        </button>

                                        {/* 5. Bağlantıyı Kopyala (Share) */}
                                        <button
                                            onClick={() => handleCopyPostLink(post.id)}
                                            style={styles.actionBtn}
                                            title="Bağlantıyı Kopyala"
                                        >
                                            <ShareIcon size={16} />
                                        </button>
                                    </div>

                                    {/* YORUMLAR BÖLÜMÜ */}
                                    {isCommentsOpen && (
                                        <div style={styles.commentsSection}>
                                            {/* Yorumlar Listesi */}
                                            {comments.length > 0 ? (
                                                <div style={styles.commentsList}>
                                                    {comments.filter(c => c.parent_id === null).map((mainComment) => (
                                                        <div key={mainComment.id} style={styles.commentItem}>
                                                            <div style={styles.commentMain}>
                                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                        <span style={styles.commentAuthor}>{mainComment.display_name}</span>
                                                                        {mainComment.badge && <span style={styles.commentBadge}>{mainComment.badge}</span>}
                                                                    </div>
                                                                    <span style={styles.commentDate}>{formatRelativeTime(mainComment.tarih)}</span>
                                                                </div>
                                                                <p style={styles.commentContent}>{renderParsedContent(mainComment.content)}</p>
                                                                {user && (
                                                                    <button
                                                                        onClick={() => setReplyingTo(prev => ({
                                                                            ...prev,
                                                                            [post.id]: { commentId: mainComment.id, userName: mainComment.display_name }
                                                                        }))}
                                                                        style={styles.replyActionBtn}
                                                                    >
                                                                        Yanıtla
                                                                    </button>
                                                                )}
                                                            </div>

                                                            {/* Yanıtlar (Alt Yorumlar) */}
                                                            {comments.filter(sub => sub.parent_id === mainComment.id).map((subComment) => (
                                                                <div key={subComment.id} style={styles.subCommentItem}>
                                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                            <span style={styles.subCommentAuthor}>{subComment.display_name}</span>
                                                                            {subComment.badge && <span style={styles.commentBadge}>{subComment.badge}</span>}
                                                                        </div>
                                                                        <span style={styles.commentDate}>{formatRelativeTime(subComment.tarih)}</span>
                                                                    </div>
                                                                    <p style={styles.subCommentContent}>{renderParsedContent(subComment.content)}</p>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <p style={styles.noCommentsText}>Henüz yorum yapılmamış.</p>
                                            )}

                                            {/* Yorum Yazma Formu */}
                                            {user ? (
                                                <div style={styles.addCommentBox}>
                                                    {replyingTo[post.id] && (
                                                        <div style={styles.replyingBanner}>
                                                            <span><b>{replyingTo[post.id].userName}</b> kullanıcısına yanıt veriliyor</span>
                                                            <button
                                                                onClick={() => setReplyingTo(prev => ({ ...prev, [post.id]: null }))}
                                                                style={styles.cancelReplyBtn}
                                                            >
                                                                İptal
                                                            </button>
                                                        </div>
                                                    )}
                                                    <div style={styles.commentInputRow}>
                                                        <input
                                                            type="text"
                                                            value={commentInputs[post.id] || ''}
                                                            onChange={(e) => setCommentInputs(prev => ({ ...prev, [post.id]: e.target.value }))}
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter' && !e.shiftKey) {
                                                                    e.preventDefault();
                                                                    handleSendComment(post.id);
                                                                }
                                                            }}
                                                            placeholder="Bir yorum yazın..."
                                                            style={styles.commentInput}
                                                        />
                                                        <button
                                                            onClick={() => handleSendComment(post.id)}
                                                            disabled={!commentInputs[post.id]?.trim()}
                                                            style={{
                                                                ...styles.sendCommentBtn,
                                                                opacity: commentInputs[post.id]?.trim() ? 1 : 0.4
                                                            }}
                                                        >
                                                            Gönder
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <p style={styles.loginToCommentText}>Yorum yazmak için lütfen giriş yapın.</p>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* ALINTI / REPOST MODALI */}
            {quoteModalPost && (
                <div style={styles.modalBackdrop} onClick={() => setQuoteModalPost(null)}>
                    <div style={styles.quoteModalCard} onClick={(e) => e.stopPropagation()}>
                        <div style={styles.modalHeader}>
                            <h3 style={{ margin: 0, fontSize: '16px', color: '#fff' }}>Gönderiyi Alıntıla</h3>
                            <button onClick={() => setQuoteModalPost(null)} style={styles.closeModalBtn}>
                                <CloseIcon size={16} color="#aaa" />
                            </button>
                        </div>
                        <textarea
                            value={quoteText}
                            onChange={(e) => setQuoteText(e.target.value)}
                            placeholder="Düşüncelerinizi ekleyin..."
                            style={styles.quoteTextarea}
                            rows={3}
                            autoFocus
                        />
                        {/* Orijinal Gönderi Önizleme Kutusu */}
                        <div style={styles.repostCard}>
                            <span style={styles.repostAuthor}>{quoteModalPost.display_name}</span>
                            <p style={styles.repostContent}>{quoteModalPost.content}</p>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '14px', gap: '8px' }}>
                            <button onClick={() => setQuoteModalPost(null)} style={styles.cancelBtn}>
                                İptal
                            </button>
                            <button onClick={handleCreateQuotePost} disabled={isSubmitting} style={styles.publishBtn}>
                                {isSubmitting ? 'Paylaşılıyor...' : 'Alıntıla ve Paylaş'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* GÖRSEL LIGHTBOX MODALI */}
            {lightboxImage && (
                <div style={styles.lightboxBackdrop} onClick={() => setLightboxImage(null)}>
                    <button style={styles.lightboxCloseBtn} onClick={() => setLightboxImage(null)}>
                        <CloseIcon size={20} color="#fff" />
                    </button>
                    <img src={lightboxImage} alt="Full View" style={styles.lightboxImg} onClick={(e) => e.stopPropagation()} />
                </div>
            )}

            {/* MİNİ PROFİL AÇILIR KARTI */}
            {miniProfileUser && miniProfileData && (
                <div
                    style={{
                        ...styles.miniProfileCard,
                        top: miniProfilePos.y,
                        left: Math.min(miniProfilePos.x, window.innerWidth - 300)
                    }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
                        <div style={styles.avatar}>
                            {miniProfileData.profile_image ? (
                                <img src={miniProfileData.profile_image} alt="" style={styles.avatarImg} />
                            ) : (
                                <span>{(miniProfileData.display_name || 'U')[0].toUpperCase()}</span>
                            )}
                        </div>
                        <div>
                            <div style={{ fontWeight: 'bold', fontSize: '15px', color: '#fff' }}>{miniProfileData.display_name}</div>
                            <div style={styles.userBadge}>{miniProfileData.badge || 'Maker'}</div>
                        </div>
                    </div>

                    {miniProfileData.bio && (
                        <p style={{ fontSize: '13px', color: '#ccc', margin: '0 0 10px 0', lineHeight: '1.4' }}>
                            {miniProfileData.bio}
                        </p>
                    )}

                    <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: '#888', marginBottom: '12px' }}>
                        <span><b>{miniProfileData.posts_count}</b> Gönderi</span>
                        <span><b>{miniProfileData.likes_received}</b> Beğeni</span>
                    </div>

                    {user && user.id !== miniProfileData.id && (
                        <button
                            onClick={() => {
                                setMiniProfileUser(null);
                                window.dispatchEvent(new CustomEvent('toggle-dm-widget'));
                            }}
                            style={styles.dmActionBtn}
                        >
                            Mesaj Gönder
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}

// 1-4 Fotoğraf Grid Düzen Yardımcıları
function getImageGridLayout(count) {
    if (count === 1) return { display: 'block' };
    if (count === 2) return { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' };
    if (count === 3) return { display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '4px' };
    return { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' };
}

function getImageGridItemStyle(count, index) {
    if (count === 1) return { maxHeight: '450px' };
    if (count === 3 && index === 0) return { gridRow: 'span 2', height: '260px' };
    return { height: count === 2 ? '220px' : '128px' };
}

const styles = {
    container: {
        backgroundColor: '#0a0a0f',
        minHeight: 'calc(100vh - 80px)',
        padding: '24px 16px 60px 16px',
        display: 'flex',
        justifyContent: 'center',
        color: '#fff',
        position: 'relative'
    },
    feedWrapper: {
        width: '100%',
        maxWidth: '680px',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px'
    },
    toast: {
        position: 'fixed',
        bottom: '24px',
        left: '50%',
        transform: 'translateX(-50%)',
        backgroundColor: '#1e293b',
        color: '#fff',
        padding: '10px 18px',
        borderRadius: '24px',
        fontSize: '13px',
        fontWeight: 'bold',
        boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
        border: '1px solid #334155',
        zIndex: 9999
    },
    header: {
        display: 'flex',
        flexDirection: 'column',
        gap: '12px'
    },
    headerTop: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '12px'
    },
    title: {
        fontSize: '24px',
        fontWeight: 'bold',
        margin: 0,
        color: '#fff',
        letterSpacing: '0.3px'
    },
    searchBox: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        backgroundColor: '#12121c',
        border: '1px solid #222235',
        borderRadius: '20px',
        padding: '6px 14px',
        width: '220px'
    },
    searchInput: {
        background: 'none',
        border: 'none',
        outline: 'none',
        color: '#fff',
        fontSize: '13px',
        width: '100%'
    },
    clearSearchBtn: {
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        padding: 0,
        display: 'flex',
        alignItems: 'center'
    },
    tabsContainer: {
        display: 'flex',
        borderBottom: '1px solid #1a1a28',
        gap: '8px'
    },
    tabBtn: {
        background: 'none',
        border: 'none',
        padding: '10px 16px',
        fontSize: '14px',
        fontWeight: 'bold',
        cursor: 'pointer',
        transition: 'all 0.15s ease'
    },

    // Yeni Gönderi Kartı
    createCard: {
        backgroundColor: '#12121c',
        border: '1px solid #222235',
        borderRadius: '12px',
        padding: '16px',
        boxShadow: '0 4px 16px rgba(0,0,0,0.4)'
    },
    createHeader: {
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        marginBottom: '12px'
    },
    avatar: {
        width: '40px',
        height: '40px',
        borderRadius: '50%',
        backgroundColor: '#1e1e2e',
        color: '#38bdf8',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 'bold',
        fontSize: '15px',
        overflow: 'hidden',
        border: '1px solid #2d2d42'
    },
    avatarSmall: {
        width: '36px',
        height: '36px',
        borderRadius: '50%',
        backgroundColor: '#1e1e2e',
        color: '#38bdf8',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 'bold',
        fontSize: '14px',
        overflow: 'hidden',
        border: '1px solid #2d2d42'
    },
    avatarImg: {
        width: '100%',
        height: '100%',
        objectFit: 'cover'
    },
    createUserName: {
        fontWeight: 'bold',
        fontSize: '14px',
        color: '#fff',
        marginRight: '8px'
    },
    userBadge: {
        fontSize: '11px',
        backgroundColor: 'rgba(56, 189, 248, 0.12)',
        color: '#38bdf8',
        border: '1px solid rgba(56, 189, 248, 0.25)',
        padding: '1px 7px',
        borderRadius: '10px',
        fontWeight: 'bold'
    },
    textarea: {
        width: '100%',
        boxSizing: 'border-box',
        backgroundColor: '#181826',
        border: '1px solid #27273a',
        borderRadius: '8px',
        padding: '12px 14px',
        color: '#fff',
        fontSize: '14px',
        lineHeight: '1.5',
        resize: 'vertical',
        outline: 'none',
        fontFamily: 'inherit',
        marginBottom: '10px'
    },
    previewsRow: {
        display: 'flex',
        gap: '8px',
        marginBottom: '10px',
        flexWrap: 'wrap'
    },
    previewBox: {
        position: 'relative',
        width: '70px',
        height: '70px',
        borderRadius: '6px',
        overflow: 'hidden',
        border: '1px solid #33334d'
    },
    previewThumb: {
        width: '100%',
        height: '100%',
        objectFit: 'cover'
    },
    removePreviewBtn: {
        position: 'absolute',
        top: '2px',
        right: '2px',
        backgroundColor: 'rgba(0,0,0,0.75)',
        color: '#fff',
        border: 'none',
        borderRadius: '50%',
        width: '18px',
        height: '18px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer'
    },
    pollFormContainer: {
        backgroundColor: '#181826',
        border: '1px solid #27273a',
        borderRadius: '8px',
        padding: '12px',
        marginBottom: '10px'
    },
    pollInput: {
        width: '100%',
        boxSizing: 'border-box',
        backgroundColor: '#11111a',
        border: '1px solid #2e2e42',
        borderRadius: '6px',
        padding: '8px 10px',
        color: '#fff',
        fontSize: '13px',
        outline: 'none',
        marginBottom: '6px'
    },
    closePollBtn: {
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        padding: '2px'
    },
    pollOptionRemoveBtn: {
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        padding: '4px',
        color: '#888'
    },
    addPollOptionBtn: {
        background: 'none',
        border: 'none',
        color: '#38bdf8',
        fontSize: '12px',
        fontWeight: 'bold',
        cursor: 'pointer',
        padding: '4px 0',
        marginTop: '2px'
    },
    createFooter: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
    },
    actionToolBtn: {
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        backgroundColor: '#181824',
        border: '1px solid #27273a',
        padding: '6px 12px',
        borderRadius: '6px',
        color: '#aaa',
        fontSize: '12px',
        cursor: 'pointer',
        transition: 'all 0.15s ease'
    },
    actionToolText: {
        fontSize: '12px'
    },
    publishBtn: {
        backgroundColor: '#780000',
        color: '#fff',
        border: 'none',
        padding: '8px 20px',
        borderRadius: '6px',
        fontWeight: 'bold',
        fontSize: '13px',
        transition: 'all 0.15s ease'
    },
    errorBanner: {
        backgroundColor: 'rgba(239, 68, 68, 0.12)',
        color: '#ef4444',
        border: '1px solid rgba(239, 68, 68, 0.25)',
        padding: '8px 12px',
        borderRadius: '6px',
        fontSize: '13px',
        marginBottom: '10px'
    },
    guestNotice: {
        backgroundColor: '#12121c',
        border: '1px solid #222235',
        borderRadius: '10px',
        padding: '14px 18px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        color: '#888',
        fontSize: '13px'
    },
    guestLoginBtn: {
        backgroundColor: '#38bdf8',
        color: '#000',
        textDecoration: 'none',
        padding: '6px 14px',
        borderRadius: '6px',
        fontWeight: 'bold',
        fontSize: '12px'
    },

    // Akış Gönderi Kartı
    postsList: {
        display: 'flex',
        flexDirection: 'column',
        gap: '16px'
    },
    postCard: {
        backgroundColor: '#12121c',
        border: '1px solid #222235',
        borderRadius: '12px',
        padding: '16px 18px',
        boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px'
    },
    postHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
    },
    authorClickable: {
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        cursor: 'pointer'
    },
    postAuthorName: {
        fontWeight: 'bold',
        fontSize: '14px',
        color: '#fff'
    },
    postBadge: {
        fontSize: '10px',
        backgroundColor: 'rgba(56, 189, 248, 0.12)',
        color: '#38bdf8',
        border: '1px solid rgba(56, 189, 248, 0.25)',
        padding: '1px 6px',
        borderRadius: '8px',
        fontWeight: 'bold'
    },
    postRelativeTime: {
        fontSize: '11px',
        color: '#666'
    },
    deletePostBtn: {
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        padding: '4px',
        display: 'flex',
        alignItems: 'center'
    },
    postBody: {
        display: 'flex',
        flexDirection: 'column',
        gap: '10px'
    },
    postText: {
        fontSize: '14px',
        lineHeight: '1.5',
        color: '#e4e4e7',
        margin: 0,
        whiteSpace: 'pre-wrap'
    },
    hashtag: {
        color: '#38bdf8',
        fontWeight: 'bold',
        cursor: 'pointer'
    },
    mention: {
        color: '#818cf8',
        fontWeight: 'bold',
        cursor: 'pointer'
    },

    // 1-4 Görsel Izgarası
    imageGrid: {
        borderRadius: '8px',
        overflow: 'hidden',
        border: '1px solid #222235',
        backgroundColor: '#0a0a0f'
    },
    imageGridItem: {
        position: 'relative',
        overflow: 'hidden',
        cursor: 'pointer'
    },
    gridImage: {
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        display: 'block'
    },

    // Anket Görünümü
    pollContainer: {
        backgroundColor: '#161622',
        border: '1px solid #27273a',
        borderRadius: '8px',
        padding: '12px'
    },
    pollQuestion: {
        fontSize: '13px',
        fontWeight: 'bold',
        color: '#fff',
        marginBottom: '10px'
    },
    pollOptionsList: {
        display: 'flex',
        flexDirection: 'column',
        gap: '6px'
    },
    pollOptionBar: {
        position: 'relative',
        border: '1px solid #27273a',
        borderRadius: '6px',
        overflow: 'hidden',
        backgroundColor: '#111119'
    },
    pollFillBar: {
        position: 'absolute',
        top: 0,
        left: 0,
        bottom: 0,
        transition: 'width 0.3s ease'
    },
    pollOptionContent: {
        position: 'relative',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '8px 12px',
        fontSize: '13px'
    },
    pollPercentage: {
        fontWeight: 'bold',
        fontSize: '12px',
        color: '#aaa'
    },
    pollTotalVotes: {
        display: 'block',
        fontSize: '11px',
        color: '#666',
        marginTop: '8px'
    },

    // Repost / Alıntı Kartı
    repostCard: {
        backgroundColor: '#161624',
        border: '1px solid #2c2c40',
        borderRadius: '8px',
        padding: '10px 12px',
        display: 'flex',
        flexDirection: 'column',
        gap: '4px'
    },
    repostHeader: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
    },
    repostAuthor: {
        fontWeight: 'bold',
        fontSize: '12px',
        color: '#fff'
    },
    repostTime: {
        fontSize: '10px',
        color: '#666'
    },
    repostContent: {
        fontSize: '13px',
        color: '#ccc',
        margin: 0,
        lineHeight: '1.4'
    },
    repostImage: {
        width: '100%',
        maxHeight: '180px',
        objectFit: 'cover',
        borderRadius: '4px',
        marginTop: '6px',
        cursor: 'pointer'
    },

    // Aksiyon Butonları Satırı
    postActionsRow: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: '8px',
        borderTop: '1px solid #1a1a28'
    },
    actionBtn: {
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '4px 6px',
        color: '#888',
        fontSize: '12px',
        transition: 'color 0.15s ease'
    },
    actionCount: {
        fontSize: '12px',
        fontWeight: 'bold'
    },

    // Yorumlar Bölümü
    commentsSection: {
        backgroundColor: '#0d0d16',
        border: '1px solid #1c1c2b',
        borderRadius: '8px',
        padding: '14px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        marginTop: '4px'
    },
    commentsList: {
        display: 'flex',
        flexDirection: 'column',
        gap: '10px'
    },
    commentItem: {
        display: 'flex',
        flexDirection: 'column',
        gap: '4px'
    },
    commentMain: {
        backgroundColor: '#141420',
        padding: '8px 12px',
        borderRadius: '6px',
        border: '1px solid #242438'
    },
    commentAuthor: {
        fontWeight: 'bold',
        fontSize: '12px',
        color: '#fff'
    },
    commentBadge: {
        fontSize: '9px',
        backgroundColor: 'rgba(56, 189, 248, 0.12)',
        color: '#38bdf8',
        padding: '1px 5px',
        borderRadius: '6px'
    },
    commentDate: {
        fontSize: '10px',
        color: '#666'
    },
    commentContent: {
        fontSize: '12px',
        color: '#ccc',
        margin: '4px 0 2px 0',
        lineHeight: '1.4'
    },
    replyActionBtn: {
        background: 'none',
        border: 'none',
        color: '#38bdf8',
        cursor: 'pointer',
        fontSize: '11px',
        fontWeight: 'bold',
        padding: 0
    },
    subCommentItem: {
        marginLeft: '20px',
        backgroundColor: '#11111b',
        padding: '6px 10px',
        borderRadius: '6px',
        borderLeft: '2px solid #38bdf8',
        marginTop: '2px'
    },
    subCommentAuthor: {
        fontWeight: 'bold',
        fontSize: '11px',
        color: '#aaa'
    },
    subCommentContent: {
        fontSize: '11px',
        color: '#bbb',
        margin: '2px 0 0 0'
    },
    noCommentsText: {
        color: '#666',
        fontSize: '12px',
        textAlign: 'center',
        margin: 0,
        padding: '6px 0'
    },
    addCommentBox: {
        display: 'flex',
        flexDirection: 'column',
        gap: '6px'
    },
    replyingBanner: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: 'rgba(56, 189, 248, 0.1)',
        padding: '4px 8px',
        borderRadius: '4px',
        fontSize: '11px',
        color: '#38bdf8'
    },
    cancelReplyBtn: {
        background: 'none',
        border: 'none',
        color: '#ef4444',
        cursor: 'pointer',
        fontSize: '11px'
    },
    commentInputRow: {
        display: 'flex',
        gap: '6px',
        alignItems: 'center'
    },
    commentInput: {
        flex: 1,
        backgroundColor: '#181826',
        border: '1px solid #29293d',
        borderRadius: '6px',
        padding: '8px 10px',
        color: '#fff',
        fontSize: '12px',
        outline: 'none'
    },
    sendCommentBtn: {
        backgroundColor: '#780000',
        color: '#fff',
        border: 'none',
        borderRadius: '6px',
        padding: '8px 14px',
        fontSize: '12px',
        fontWeight: 'bold',
        cursor: 'pointer'
    },
    loginToCommentText: {
        color: '#666',
        fontSize: '11px',
        textAlign: 'center',
        margin: 0
    },

    // Modal & Popuplar
    modalBackdrop: {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '16px'
    },
    quoteModalCard: {
        backgroundColor: '#12121c',
        border: '1px solid #27273a',
        borderRadius: '12px',
        padding: '18px',
        width: '100%',
        maxWidth: '520px'
    },
    modalHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '12px'
    },
    closeModalBtn: {
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        padding: '4px'
    },
    quoteTextarea: {
        width: '100%',
        boxSizing: 'border-box',
        backgroundColor: '#181826',
        border: '1px solid #27273a',
        borderRadius: '8px',
        padding: '10px 12px',
        color: '#fff',
        fontSize: '14px',
        resize: 'none',
        outline: 'none',
        fontFamily: 'inherit',
        marginBottom: '10px'
    },
    cancelBtn: {
        backgroundColor: '#222232',
        color: '#aaa',
        border: 'none',
        padding: '8px 16px',
        borderRadius: '6px',
        fontWeight: 'bold',
        fontSize: '12px',
        cursor: 'pointer'
    },

    // Lightbox
    lightboxBackdrop: {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.92)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
        padding: '20px'
    },
    lightboxCloseBtn: {
        position: 'absolute',
        top: '20px',
        right: '20px',
        background: 'none',
        border: 'none',
        cursor: 'pointer'
    },
    lightboxImg: {
        maxWidth: '90vw',
        maxHeight: '90vh',
        objectFit: 'contain',
        borderRadius: '4px'
    },

    // Mini Profil
    miniProfileCard: {
        position: 'absolute',
        backgroundColor: '#141422',
        border: '1px solid #29293d',
        borderRadius: '10px',
        padding: '14px',
        width: '240px',
        boxShadow: '0 10px 28px rgba(0,0,0,0.6)',
        zIndex: 1000
    },
    dmActionBtn: {
        width: '100%',
        backgroundColor: '#38bdf8',
        color: '#000',
        border: 'none',
        padding: '7px 0',
        borderRadius: '6px',
        fontWeight: 'bold',
        fontSize: '12px',
        cursor: 'pointer'
    },
    loadingContainer: {
        textAlign: 'center',
        padding: '40px 0'
    },
    emptyState: {
        backgroundColor: '#12121c',
        border: '1px solid #222235',
        borderRadius: '12px',
        padding: '40px 20px',
        textAlign: 'center'
    }
};
