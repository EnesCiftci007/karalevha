import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { API_URL } from '../config';
import { useLanguage } from '../i18n/LanguageContext';
import { parseUTC } from '../config';

const Uye = () => {
    const { t } = useLanguage();
    const location = useLocation();
    const [posts, setPosts] = useState([]);
    const [isEditing, setIsEditing] = useState(false);

    // Profil Alanları Stateleri
    const [displayName, setDisplayName] = useState('');
    const [bio, setBio] = useState('');
    const [customLink, setCustomLink] = useState('');
    const [selectedFile, setSelectedFile] = useState(null);
    const [message, setMessage] = useState({ type: '', text: '' });

    // Dinamik API Kökü (Config'ten gelir veya göreceli / olarak çalışır)
    const BASE = API_URL || '';

    // Tarayıcı oturumundan güncel kullanıcıyı çek
    const storedUser = localStorage.getItem('user');
    const user = storedUser ? JSON.parse(storedUser) : null;

    // URL'de ?duzenle=1 varsa doğrudan düzenleme modunu aç
    useEffect(() => {
        const params = new URLSearchParams(location.search);
        if (params.get('duzenle') === '1') {
            setIsEditing(true);
        }
    }, [location.search]);

    useEffect(() => {
        if (user) {
            setDisplayName(user.display_name || '');
            setBio(user.bio || '');
            setCustomLink(user.custom_link || '');

            // Kullanıcının paylaştığı forum gönderilerini çek (Dinamik Yola Geçirildi)
            fetch(`${BASE}/api/user/${user.id}/posts`)
                .then(res => res.json())
                .then(data => {
                    if (Array.isArray(data)) setPosts(data);
                })
                .catch(err => console.error("Kullanıcı gönderileri alınamadı:", err));
        }
    }, []);

    // Profil Güncelleme Kayıt İşlemi
    const handleUpdateProfile = (e) => {
        e.preventDefault();
        if (!user) return;

        const formData = new FormData();
        formData.append('user_id', user.id);
        formData.append('display_name', displayName);
        formData.append('bio', bio);
        formData.append('custom_link', customLink);
        if (selectedFile) {
            formData.append('file', selectedFile);
        }

        // Dinamik Yola Geçirildi
        fetch(`${BASE}/api/user/profile`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }, body: formData // Tarayıcı Content-Type'ı otomatik boundary ile ayarlayacak
        })
            .then(res => res.json())
            .then(data => {
                if (data.status === 'success') {
                    // LocalStorage'ı yeni gelen verilerle tazeleyelim
                    localStorage.setItem('user', JSON.stringify(data.user));
                    setMessage({ type: 'success', text: t('profile_updated_success') });
                    setIsEditing(false);
                    // Sayfadaki anlık görüntünün yenilenmesi için ufak bir gecikmeyle reload atabiliriz
                    setTimeout(() => window.location.reload(), 1000);
                } else {
                    setMessage({ type: 'error', text: data.detail || t('error_occurred') });
                }
            })
            .catch(() => setMessage({ type: 'error', text: t('server_error') }));
    };

    if (!user) {
        return (
            <div style={styles.container}>
                <div style={styles.infoBox}>
                    <p style={{ color: '#f1c40f' }}>{t('profile_please_login')}</p>
                </div>
            </div>
        );
    }

    return (
        <div style={styles.container}>
            <div style={styles.profileCard}>
                {/* Sol Taraf: Profil Resmi ve Rozet */}
                <div style={styles.avatarSection}>
                    <div style={styles.avatarContainer}>
                        {user.profile_image ? (
                            <img src={user.profile_image} alt="Profil" style={styles.avatar} />
                        ) : (
                            <div style={styles.avatarPlaceholder}>
                                {user.display_name ? user.display_name.substring(0, 2).toUpperCase() : 'MK'}
                            </div>
                        )}
                    </div>
                    {/* Ünvan / Rozet Alanı */}
                    <span style={styles.badgeTag}>🛡️ {user.badge || 'Maker'}</span>
                </div>

                {/* Sağ Taraf: Detaylar ve Düzenleme Formu */}
                <div style={styles.detailsSection}>
                    {message.text && (
                        <p style={{ ...styles.msg, color: message.type === 'success' ? '#2ecc71' : '#e74c3c' }}>
                            {message.text}
                        </p>
                    )}

                    {!isEditing ? (
                        <>
                            <h2 style={styles.nameTitle}>{user.display_name}</h2>
                            <p style={styles.emailText}>✉️ {user.email}</p>

                            <div style={styles.bioBox}>
                                <h4 style={{ color: '#555', marginBottom: '5px', fontSize: '12px', textTransform: 'uppercase' }}>{t('profile_bio')}</h4>
                                <p style={{ color: user.bio ? '#ccc' : '#555', fontStyle: user.bio ? 'normal' : 'italic' }}>
                                    {user.bio || t('profile_bio_empty')}
                                </p>
                            </div>

                            {user.custom_link && (
                                <div style={styles.linkBox}>
                                    <span style={{ marginRight: '8px' }}>🔗</span>
                                    <a href={user.custom_link} target="_blank" rel="noopener noreferrer" style={styles.linkElement}>
                                        {user.custom_link}
                                    </a>
                                </div>
                            )}
                        </>
                    ) : (
                        <form onSubmit={handleUpdateProfile} style={styles.formLayout}>
                            <h3 style={{ color: '#3498db', marginBottom: '15px' }}>{t('profile_update_title')}</h3>

                            <label style={styles.label}>{t('profile_display_name')}</label>
                            <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} style={styles.input} required />

                            <label style={styles.label}>{t('profile_bio')}</label>
                            <textarea placeholder={t('profile_bio_placeholder')} value={bio} onChange={(e) => setBio(e.target.value)} style={styles.textarea} />

                            <label style={styles.label}>{t('profile_custom_link')}</label>
                            <input type="url" placeholder="https://example.com" value={customLink} onChange={(e) => setCustomLink(e.target.value)} style={styles.input} />

                            <label style={styles.label}>{t('profile_change_image')}</label>
                            <input type="file" accept="image/*" onChange={(e) => setSelectedFile(e.target.files[0])} style={{ color: '#ccc', marginBottom: '20px' }} />

                            <div style={{ display: 'flex', gap: '10px' }}>
                                <button type="submit" style={styles.saveBtn}>{t('profile_save_changes')}</button>
                                <button type="button" onClick={() => setIsEditing(false)} style={styles.cancelBtn}>{t('profile_cancel')}</button>
                            </div>
                        </form>
                    )}
                </div>
            </div>

            {/* Alt Bölüm: Kullanıcının Paylaştığı Akış Gönderileri */}
            <div style={styles.historySection}>
                <h3 style={styles.historyTitle}>{t('profile_my_topics')}</h3>
                {posts.length === 0 ? (
                    <p style={{ color: '#555', fontStyle: 'italic' }}>{t('profile_no_topics')}</p>
                ) : (
                    posts.map(post => (
                        <div key={post.id} style={styles.postMiniCard}>
                            <p style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#e4e4e7', lineHeight: '1.5' }}>{post.content}</p>
                            <div style={styles.postMeta}>
                                <span>📅 {parseUTC(post.tarih).toLocaleDateString()}</span>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

const styles = {
    container: { padding: '30px 4%', backgroundColor: '#000000', minHeight: '90vh', color: '#fff' },
    profileCard: { display: 'flex', flexWrap: 'wrap', gap: '30px', backgroundColor: '#111', padding: '30px 20px', borderRadius: '8px', border: '1px solid #222', marginBottom: '30px' },
    avatarSection: { display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', maxWidth: '200px', margin: '0 auto', gap: '15px' },
    avatarContainer: { width: '130px', height: '130px', borderRadius: '50%', overflow: 'hidden', border: '2px solid #333', backgroundColor: '#050505' },
    avatar: { width: '100%', height: '100%', objectFit: 'cover' },
    avatarPlaceholder: { width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px', fontWeight: 'bold', color: '#666', backgroundColor: '#1c1c1c' },
    badgeTag: { backgroundColor: '#1e272e', border: '1px solid #34495e', color: '#3498db', padding: '6px 12px', borderRadius: '20px', fontSize: '13px', fontWeight: 'bold', letterSpacing: '0.5px' },
    detailsSection: { flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' },
    nameTitle: { fontSize: '28px', fontWeight: 'bold', color: '#fff', marginBottom: '5px' },
    emailText: { color: '#666', fontSize: '14px', marginBottom: '20px' },
    bioBox: { backgroundColor: '#1c1c1c', padding: '15px', borderRadius: '4px', border: '1px solid #2a2a2a', marginBottom: '15px', fontSize: '14px', lineHeight: '1.5' },
    linkBox: { display: 'flex', alignItems: 'center', marginBottom: '20px', fontSize: '14px' },
    linkElement: { color: '#3498db', textDecoration: 'none', wordBreak: 'break-all' },
    editBtn: { alignSelf: 'flex-start', backgroundColor: '#222', color: '#fff', border: '1px solid #444', padding: '10px 20px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', transition: '0.2s' },

    // Form Stilleri
    formLayout: { display: 'flex', flexDirection: 'column' },
    label: { fontSize: '13px', color: '#888', marginBottom: '5px', fontWeight: 'bold' },
    input: { padding: '10px', backgroundColor: '#000', border: '1px solid #333', borderRadius: '4px', color: '#fff', marginBottom: '15px', outline: 'none' },
    textarea: { padding: '10px', backgroundColor: '#000', border: '1px solid #333', borderRadius: '4px', color: '#fff', marginBottom: '15px', height: '80px', outline: 'none', resize: 'none' },
    saveBtn: { backgroundColor: '#2ecc71', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' },
    cancelBtn: { backgroundColor: '#333', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' },
    msg: { fontSize: '14px', marginBottom: '15px', fontWeight: 'bold' },
    infoBox: { backgroundColor: '#111', padding: '30px', borderRadius: '4px', border: '1px solid #222', textAlign: 'center' },

    // Alt Geçmiş Akışı Stilleri
    historySection: { backgroundColor: '#111', padding: '30px', borderRadius: '4px', border: '1px solid #222' },
    historyTitle: { fontSize: '20px', marginBottom: '20px', color: '#bbb' },
    postMiniCard: { backgroundColor: '#1c1c1c', padding: '15px 20px', borderRadius: '4px', marginBottom: '12px', border: '1px solid #252525' },
    postTitle: { fontSize: '16px', color: '#3498db' },
    categoryTag: { backgroundColor: '#2980b9', padding: '3px 8px', borderRadius: '3px', fontSize: '11px', color: '#fff' },
    postMeta: { marginTop: '8px', fontSize: '11px', color: '#555' }
};

export default Uye;