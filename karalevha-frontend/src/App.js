import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import Kayit from './views/kayit';
import Giris from './views/giris';
import BaskiIstasyonu from './views/BaskiIstasyonu';
import Akis from './views/Akis';
import Uye from './views/uye';
import YoneticiSayfasi from './views/YoneticiSayfasi';
import EOba from './views/EOba';
import AnaSayfa from './views/AnaSayfa';
import { API_URL } from './config';

// 🔔 & 💬 Bildirim ve DM Bileşenleri
import NotificationsDropdown from './components/NotificationsDropdown';
import DMWidget from './components/DMWidget';

// 📂 Görsel ve Logo Importları
import logoPna from './assets/logo.png';
import forumGorseli from './assets/forum.png';
import baskiGorseli from './assets/baski.png';
import eobaGorseli from './assets/eoba.jpg';

import { useLanguage } from './i18n/LanguageContext';

// 💬 Üst Bar DM Butonu (Canlı Okunmamış Mesaj Sayacı ile)
const DMNavButton = ({ user, onOpenDM }) => {
    const { t } = useLanguage();
    const [unreadCount, setUnreadCount] = useState(0);

    const loadCount = async () => {
        if (!user?.id) return;
        try {
            const res = await fetch(`${API_URL}/api/dm/conversations?user_id=${user.id}`);
            if (res.ok) {
                const data = await res.json();
                const total = (data || []).reduce((acc, c) => acc + (c.unread_count || 0), 0);
                setUnreadCount(total);
            }
        } catch {
            // Sessizce geç
        }
    };

    useEffect(() => {
        if (!user?.id) return;
        loadCount();
        const interval = setInterval(loadCount, 4000);
        return () => clearInterval(interval);
    }, [user?.id]);

    return (
        <button
            onClick={() => {
                window.dispatchEvent(new CustomEvent('toggle-dm-widget'));
                if (onOpenDM) onOpenDM(null);
            }}
            style={styles.navIconButton}
            className="nav-icon-btn"
            title={t('user_messages')}
            aria-label={t('user_messages')}
        >
            <span style={{ fontSize: '17px' }}>💬</span>
            {unreadCount > 0 && (
                <span style={styles.navIconBadge}>
                    {unreadCount > 99 ? '99+' : unreadCount}
                </span>
            )}
        </button>
    );
};

const Navbar = ({ user, onLogout, onOpenDM }) => {
    const { t, lang, setLang, languages, currentLanguage } = useLanguage();
    const location = useLocation();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [userMenuOpen, setUserMenuOpen] = useState(false);
    const [langSubmenuOpen, setLangSubmenuOpen] = useState(false);
    const userMenuRef = useRef(null);

    // 🎯 Aktif sekmeyi konuyla alakalı özel renklerle işaretleyen dinamik fonksiyon
    const getNavLinkStyle = (path) => {
        const isActive = location.pathname === path || (path !== '/' && location.pathname.startsWith(path));

        let activeColor = '#ffffff'; // Varsayılan (Ana Sayfa)
        if (path === '/akis' || path === '/forum') activeColor = '#780000'; // Akış: Kırmızı
        if (path === '/baski-istasyonu') activeColor = '#780078'; // 3B Baskı İstasyonu: Mor
        if (path === '/e-oba') activeColor = '#0066ff';          // E-Oba: Mavi

        return {
            ...styles.navLink,
            color: isActive ? activeColor : '#fff',
            fontWeight: isActive ? 'bold' : 'normal',
            borderBottom: isActive ? `2px solid ${activeColor}` : '2px solid transparent',
            paddingBottom: '5px',
            transition: '0.2s'
        };
    };

    // Sayfa değiştiğinde menüleri otomatik kapat
    useEffect(() => {
        setMobileMenuOpen(false);
        setUserMenuOpen(false);
        setLangSubmenuOpen(false);
    }, [location.pathname]);

    // Dışarı tıklandığında kullanıcı menüsünü kapat
    useEffect(() => {
        const handleOutsideClick = (e) => {
            if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
                setUserMenuOpen(false);
                setLangSubmenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleOutsideClick);
        return () => document.removeEventListener('mousedown', handleOutsideClick);
    }, []);

    // Ortak Kullanıcı & Dil Açılır Menüsü
    const renderUserDropdown = () => (
        <div style={styles.userDropdownMenu}>
            {!langSubmenuOpen ? (
                <>
                    {user && (
                        <>
                            <Link
                                to="/uye?duzenle=1"
                                onClick={() => setUserMenuOpen(false)}
                                style={styles.userDropdownItem}
                                className="user-dropdown-item"
                            >
                                <span style={{ fontSize: '14px' }}>✏️</span>
                                <span>{t('user_edit_profile')}</span>
                            </Link>
                            <div style={styles.userDropdownDivider} />
                        </>
                    )}

                    {/* Dil Seçimi Menü Butonu */}
                    <button
                        onClick={() => setLangSubmenuOpen(true)}
                        style={{
                            ...styles.userDropdownItem,
                            justifyContent: 'space-between',
                            width: '100%',
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer'
                        }}
                        className="user-dropdown-item"
                    >
                        <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '14px' }}>🌐</span>
                            <span>{t('user_language')}</span>
                        </span>
                        <span style={{ fontSize: '11px', color: '#888', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span>{currentLanguage?.flag || '🇹🇷'}</span>
                            <span>{currentLanguage?.shortName || 'TR'}</span>
                            <span style={{ fontSize: '9px' }}>▶</span>
                        </span>
                    </button>

                    {user && (
                        <>
                            <div style={styles.userDropdownDivider} />
                            <button
                                onClick={() => {
                                    setUserMenuOpen(false);
                                    onLogout();
                                }}
                                style={{
                                    ...styles.userDropdownItem,
                                    color: '#ef4444',
                                    width: '100%',
                                    textAlign: 'left',
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer'
                                }}
                                className="user-dropdown-item"
                            >
                                <span style={{ fontSize: '14px' }}>🚪</span>
                                <span>{t('user_logout')}</span>
                            </button>
                        </>
                    )}
                </>
            ) : (
                /* Dil Alt Menüsü (Tıklanınca Açılır) */
                <>
                    <div style={{ display: 'flex', alignItems: 'center', padding: '6px 12px 6px 8px', borderBottom: '1px solid #222233' }}>
                        <button
                            onClick={() => setLangSubmenuOpen(false)}
                            style={styles.submenuBackBtn}
                            title={t('btn_back')}
                        >
                            ◀
                        </button>
                        <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#fff', marginLeft: '6px' }}>
                            {t('user_language')}
                        </span>
                    </div>

                    {languages.map((l) => (
                        <button
                            key={l.code}
                            onClick={() => {
                                setLang(l.code);
                                setUserMenuOpen(false);
                                setLangSubmenuOpen(false);
                            }}
                            style={{
                                ...styles.userDropdownItem,
                                justifyContent: 'space-between',
                                width: '100%',
                                background: lang === l.code ? 'rgba(0, 102, 255, 0.18)' : 'none',
                                color: lang === l.code ? '#38bdf8' : '#e4e4e7',
                                border: 'none',
                                cursor: 'pointer',
                                padding: '8px 14px'
                            }}
                            className="user-dropdown-item"
                        >
                            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span>{l.flag}</span>
                                <span style={{ fontSize: '12px' }}>{l.name}</span>
                            </span>
                            {lang === l.code && <span style={{ fontSize: '12px', fontWeight: 'bold' }}>✓</span>}
                        </button>
                    ))}
                </>
            )}
        </div>
    );

    return (
        <nav style={styles.navbar}>
            {/* Logo Alanı */}
            <div style={styles.logoAlani}>
                <Link to="/" style={styles.navLinkLogo}>
                    <img src={logoPna} alt="Logo" style={styles.logoImage} onError={(e) => e.target.style.display = 'none'} />
                    <span style={styles.logoText}>KaraLevha</span>
                </Link>
            </div>

            {/* MASAÜSTÜ LİNKLERİ (Ekran genişken görünür) */}
            <div className="hide-on-mobile" style={styles.navLinks}>
                <Link to="/" style={getNavLinkStyle('/')}>{t('nav_home')}</Link>
                <Link to="/akis" style={getNavLinkStyle('/akis')}>{t('nav_feed')}</Link>
                <Link to="/baski-istasyonu" style={getNavLinkStyle('/baski-istasyonu')}>{t('nav_print')}</Link>
                <Link to="/e-oba" style={getNavLinkStyle('/e-oba')}>{t('nav_eoba')}</Link>

                {/* Sadece admin rolü veya badge'i olanların görebileceği buton */}
                {user && (user.role === 'admin' || user.badge === 'Admin') && (
                    <Link to="/admin" style={styles.adminNavLink}>
                        ⚙️ {t('nav_admin')}
                    </Link>
                )}

                {user ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: '6px' }}>
                        {/* 1. 👤 Profil Bloğu */}
                        <Link to="/uye" style={styles.profileNavBlock} title={t('user_my_profile')}>
                            {user.profile_image ? (
                                <img src={user.profile_image} alt="PP" style={styles.miniAvatar} />
                            ) : (
                                <span style={{ fontSize: '15px' }}>👤</span>
                            )}
                            <span style={styles.welcomeText}>{user.display_name}</span>
                            <span style={styles.miniBadge}>{user.badge || 'Maker'}</span>
                        </Link>

                        {/* 2. 💬 DM Butonu */}
                        <DMNavButton user={user} onOpenDM={onOpenDM} />

                        {/* 3. 🔔 Bildirimler Dropdown */}
                        <NotificationsDropdown user={user} onOpenDM={onOpenDM} />

                        {/* 4. ⚙️ Kullanıcı Menüsü (Profili Düzenle, Dil Seçimi & Çıkış Yap) */}
                        <div style={{ position: 'relative' }} ref={userMenuRef}>
                            <button
                                onClick={() => {
                                    setUserMenuOpen(!userMenuOpen);
                                    setLangSubmenuOpen(false);
                                }}
                                style={{
                                    ...styles.navMenuBtn,
                                    backgroundColor: userMenuOpen ? '#1e1e2d' : '#111119'
                                }}
                                className="nav-menu-btn"
                                title="Hesap Menüsü"
                                aria-label="Hesap Menüsü"
                            >
                                <span style={{ fontSize: '16px', lineHeight: 1 }}>⋮</span>
                            </button>

                            {userMenuOpen && renderUserDropdown()}
                        </div>
                    </div>
                ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: '6px' }}>
                        <Link to="/giris" style={styles.loginLink}>
                            <span style={{ fontSize: '18px', marginRight: '5px' }}>👤</span> {t('nav_login')}
                        </Link>

                        {/* Misafir için Menü (Dil Seçimi vb.) */}
                        <div style={{ position: 'relative' }} ref={userMenuRef}>
                            <button
                                onClick={() => {
                                    setUserMenuOpen(!userMenuOpen);
                                    setLangSubmenuOpen(false);
                                }}
                                style={{
                                    ...styles.navMenuBtn,
                                    backgroundColor: userMenuOpen ? '#1e1e2d' : '#111119'
                                }}
                                className="nav-menu-btn"
                                title="Menü"
                                aria-label="Menü"
                            >
                                <span style={{ fontSize: '16px', lineHeight: 1 }}>⋮</span>
                            </button>

                            {userMenuOpen && renderUserDropdown()}
                        </div>
                    </div>
                )}
            </div>

            {/* MOBİL ÜST BAR SAĞ KISIM (DM + Bildirim Çanı + Hamburger Butonu) */}
            <div className="show-on-mobile hide-on-desktop" style={{ display: 'none', alignItems: 'center', gap: '8px' }}>
                {user && (
                    <>
                        <DMNavButton user={user} onOpenDM={onOpenDM} />
                        <NotificationsDropdown user={user} onOpenDM={onOpenDM} />
                    </>
                )}

                <button
                    onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                    style={styles.hamburgerBtn}
                    aria-label="Menüyü Aç/Kapat"
                >
                    {mobileMenuOpen ? '✕' : '☰'}
                </button>
            </div>

            {/* MOBİL ÇEKMECE MENÜSÜ (Açıldığında kayar) */}
            {mobileMenuOpen && (
                <div style={styles.mobileDropdownMenu}>
                    <div style={styles.mobileNavLinksList}>
                        <Link to="/" style={styles.mobileNavLink}>🏠 {t('nav_home')}</Link>
                        <Link to="/akis" style={styles.mobileNavLink}>{t('nav_feed')}</Link>
                        <Link to="/baski-istasyonu" style={styles.mobileNavLink}>🖨️ {t('nav_print')}</Link>
                        <Link to="/e-oba" style={{ ...styles.mobileNavLink, color: '#3b82f6' }}>⛺ {t('home_card_eoba')}</Link>

                        {user && (user.role === 'admin' || user.badge === 'Admin') && (
                            <Link to="/admin" style={{ ...styles.mobileNavLink, color: '#ef4444' }}>
                                ⚙️ {t('nav_admin')}
                            </Link>
                        )}
                    </div>

                    {/* Mobil Dil Seçimi */}
                    <div style={styles.mobileLangSection}>
                        <span style={styles.mobileLangTitle}>🌐 {t('user_language')}:</span>
                        <div style={styles.mobileLangGrid}>
                            {languages.map((l) => (
                                <button
                                    key={l.code}
                                    onClick={() => setLang(l.code)}
                                    style={{
                                        ...styles.mobileLangBtn,
                                        backgroundColor: lang === l.code ? '#0066ff' : '#171725',
                                        borderColor: lang === l.code ? '#38bdf8' : '#27273a',
                                        color: lang === l.code ? '#fff' : '#ccc'
                                    }}
                                >
                                    <span>{l.flag}</span>
                                    <span>{l.shortName}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div style={styles.mobileUserSection}>
                        {user ? (
                            <>
                                <Link to="/uye" style={styles.mobileProfileBlock}>
                                    {user.profile_image ? (
                                        <img src={user.profile_image} alt="" style={styles.miniAvatar} />
                                    ) : (
                                        <span style={{ fontSize: '16px' }}>👤</span>
                                    )}
                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                        <span style={{ fontWeight: 'bold', color: '#fff', fontSize: '14px' }}>{user.display_name}</span>
                                        <span style={{ fontSize: '11px', color: '#3b82f6' }}>{user.badge || 'Maker'}</span>
                                    </div>
                                </Link>

                                <Link
                                    to="/uye?duzenle=1"
                                    onClick={() => setMobileMenuOpen(false)}
                                    style={styles.mobileEditProfileBtn}
                                >
                                    ✏️ {t('user_edit_profile')}
                                </Link>

                                <button
                                    onClick={() => {
                                        setMobileMenuOpen(false);
                                        window.dispatchEvent(new CustomEvent('toggle-dm-widget'));
                                        if (onOpenDM) onOpenDM(null);
                                    }}
                                    style={styles.mobileDmBtn}
                                >
                                    💬 {t('user_open_messages')}
                                </button>

                                <button onClick={onLogout} style={styles.mobileLogoutBtn}>
                                    🚪 {t('user_logout')}
                                </button>
                            </>
                        ) : (
                            <Link to="/giris" style={styles.mobileLoginBtn}>
                                👤 {t('nav_login')} / {t('nav_register')}
                            </Link>
                        )}
                    </div>
                </div>
            )}
        </nav>
    );
};



function App() {
    const [user, setUser] = useState(null);
    const [dmPartnerId, setDmPartnerId] = useState(null);

    useEffect(() => {
        const checkUser = () => {
            const savedUser = localStorage.getItem('user');
            if (savedUser) {
                setUser(JSON.parse(savedUser));
            } else {
                setUser(null);
            }
        };

        checkUser();
        window.addEventListener('storage', checkUser);
        const interval = setInterval(checkUser, 1000);

        return () => {
            window.removeEventListener('storage', checkUser);
            clearInterval(interval);
        };
    }, []);

    const handleLogout = () => {
        localStorage.removeItem('user');
        setUser(null);
        window.location.href = '/giris';
    };

    const handleOpenDM = (partnerId) => {
        setDmPartnerId(partnerId);
    };

    return (
        <Router>
            <div style={{ backgroundColor: '#000000', minHeight: '100vh', color: '#fff', fontFamily: 'Arial, sans-serif', position: 'relative' }}>
                <Navbar user={user} onLogout={handleLogout} onOpenDM={handleOpenDM} />

                <Routes>
                    <Route path="/" element={<AnaSayfa />} />
                    <Route path="/kayit" element={<Kayit />} />
                    <Route path="/giris" element={<Giris />} />
                    <Route path="/baski-istasyonu" element={<BaskiIstasyonu />} />
                    <Route path="/akis" element={<Akis />} />
                    <Route path="/forum" element={<Navigate to="/akis" replace />} />
                    <Route path="/e-oba" element={<EOba user={user} />} />
                    <Route path="/e-oba/*" element={<EOba user={user} />} />
                    <Route path="/uye" element={<Uye />} />
                    <Route path="/admin" element={<YoneticiSayfasi />} />
                    <Route path="*" element={<Navigate to="/" />} />
                </Routes>

                {/* 💬 GLOBAL DİREKT MESAJLAŞMA (DM) WİDGETI */}
                {user && (
                    <DMWidget
                        user={user}
                        activePartnerId={dmPartnerId}
                        onCloseDM={() => setDmPartnerId(null)}
                    />
                )}
            </div>
        </Router>
    );
}

const styles = {
    navbar: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '16px 5%',
        backgroundColor: '#000000',
        borderBottom: '1px solid #14141c',
        position: 'relative',
        zIndex: 1000
    },
    logoAlani: { display: 'flex', alignItems: 'center' },
    navLinkLogo: { display: 'flex', alignItems: 'center', gap: '8px', color: '#fff', textDecoration: 'none', letterSpacing: '0.5px' },
    logoImage: { width: '32px', height: '32px', objectFit: 'contain', display: 'block' },
    logoText: { fontWeight: 'bold', fontSize: '22px', color: '#ffffff', lineHeight: '1' },

    navLinks: { display: 'flex', alignItems: 'center', gap: '22px' },
    navLink: { color: '#fff', textDecoration: 'none', fontSize: '14px' },
    loginLink: { color: '#fff', textDecoration: 'none', fontSize: '14px', display: 'flex', alignItems: 'center' },

    adminNavLink: { color: '#e74c3c', textDecoration: 'none', fontSize: '13px', fontWeight: 'bold', backgroundColor: '#1a0d0d', padding: '6px 12px', borderRadius: '6px', border: '1px solid #c0392b', transition: '0.2s' },

    profileNavBlock: { display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none', cursor: 'pointer', backgroundColor: '#111119', padding: '6px 12px', borderRadius: '6px', border: '1px solid #222233' },
    miniAvatar: { width: '22px', height: '22px', borderRadius: '50%', objectFit: 'cover', border: '1px solid #444' },
    welcomeText: { color: '#fff', fontSize: '13px', fontWeight: 'bold' },
    miniBadge: { backgroundColor: '#1e272e', border: '1px solid #34495e', color: '#3498db', padding: '2px 6px', borderRadius: '10px', fontSize: '10px', fontWeight: 'bold' },

    navIconButton: {
        position: 'relative',
        backgroundColor: '#111119',
        border: '1px solid #222233',
        borderRadius: '8px',
        width: '36px',
        height: '36px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        color: '#fff',
        transition: 'all 0.15s ease'
    },
    navIconBadge: {
        position: 'absolute',
        top: '-4px',
        right: '-4px',
        backgroundColor: '#0066ff',
        color: '#fff',
        fontSize: '10px',
        fontWeight: 'bold',
        padding: '2px 5px',
        borderRadius: '10px',
        border: '2px solid #000',
        minWidth: '16px',
        textAlign: 'center',
        lineHeight: 1
    },
    navMenuBtn: {
        backgroundColor: '#111119',
        border: '1px solid #222233',
        borderRadius: '8px',
        width: '32px',
        height: '36px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        color: '#ccc',
        transition: 'all 0.15s ease'
    },
    userDropdownMenu: {
        position: 'absolute',
        top: 'calc(100% + 8px)',
        right: 0,
        backgroundColor: '#111119',
        border: '1px solid #252538',
        borderRadius: '8px',
        padding: '6px 0',
        width: '225px',
        boxShadow: '0 12px 30px rgba(0, 0, 0, 0.8)',
        zIndex: 10002,
        display: 'flex',
        flexDirection: 'column'
    },
    userDropdownItem: {
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '9px 14px',
        color: '#e4e4e7',
        textDecoration: 'none',
        fontSize: '13px',
        fontWeight: '500',
        transition: 'background 0.15s',
        cursor: 'pointer'
    },
    submenuBackBtn: {
        backgroundColor: '#1c1c28',
        border: '1px solid #2f2f45',
        color: '#38bdf8',
        borderRadius: '4px',
        padding: '3px 7px',
        fontSize: '11px',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        lineHeight: 1
    },
    langDropdownItem: {
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '9px 14px',
        color: '#e4e4e7',
        textDecoration: 'none',
        fontSize: '13px',
        transition: 'background 0.15s',
        cursor: 'pointer',
        border: 'none',
        textAlign: 'left',
        width: '100%'
    },
    userDropdownSectionHeader: {
        padding: '4px 14px 2px 14px',
        fontSize: '11px',
        color: '#888',
        fontWeight: 'bold',
        textTransform: 'uppercase',
        letterSpacing: '0.5px'
    },
    userDropdownDivider: {
        height: '1px',
        backgroundColor: '#222233',
        margin: '4px 0'
    },
    mobileLangSection: {
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        padding: '10px 0',
        borderTop: '1px solid #141420',
        borderBottom: '1px solid #141420'
    },
    mobileLangTitle: {
        fontSize: '12px',
        color: '#888',
        fontWeight: 'bold'
    },
    mobileLangGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '8px'
    },
    mobileLangBtn: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '6px',
        padding: '8px',
        borderRadius: '6px',
        border: '1px solid',
        fontSize: '12px',
        fontWeight: 'bold',
        cursor: 'pointer',
        transition: 'all 0.15s ease'
    },
    mobileEditProfileBtn: {
        display: 'block',
        backgroundColor: '#161622',
        border: '1px solid #222235',
        color: '#fff',
        padding: '10px 14px',
        borderRadius: '6px',
        textDecoration: 'none',
        fontSize: '13px',
        fontWeight: 'bold',
        textAlign: 'center'
    },

    // Mobil Hamburger & Açılır Menü Stilleri
    hamburgerBtn: {
        backgroundColor: '#11111a',
        border: '1px solid #252538',
        color: '#fff',
        borderRadius: '8px',
        width: '38px',
        height: '38px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '20px',
        cursor: 'pointer'
    },
    mobileDropdownMenu: {
        position: 'absolute',
        top: '100%',
        left: 0,
        right: 0,
        backgroundColor: '#0a0a0f',
        borderBottom: '1px solid #222235',
        padding: '16px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        boxShadow: '0 16px 30px rgba(0, 0, 0, 0.9)',
        zIndex: 9999,
        animation: 'slideDown 0.2s ease-out'
    },
    mobileNavLinksList: {
        display: 'flex',
        flexDirection: 'column',
        gap: '12px'
    },
    mobileNavLink: {
        color: '#e2e8f0',
        textDecoration: 'none',
        fontSize: '15px',
        fontWeight: '500',
        padding: '8px 0',
        borderBottom: '1px solid #141420'
    },
    mobileUserSection: {
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        paddingTop: '10px',
        borderTop: '1px solid #1a1a28'
    },
    mobileProfileBlock: {
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        textDecoration: 'none',
        padding: '8px',
        backgroundColor: '#12121c',
        borderRadius: '8px'
    },
    mobileDmBtn: {
        backgroundColor: '#0066ff',
        color: '#fff',
        border: 'none',
        padding: '10px',
        borderRadius: '8px',
        fontWeight: 'bold',
        fontSize: '13px',
        cursor: 'pointer'
    },
    mobileLogoutBtn: {
        backgroundColor: 'rgba(239, 68, 68, 0.15)',
        color: '#ef4444',
        border: '1px solid rgba(239, 68, 68, 0.3)',
        padding: '10px',
        borderRadius: '8px',
        fontWeight: 'bold',
        fontSize: '13px',
        cursor: 'pointer'
    },
    mobileLoginBtn: {
        backgroundColor: '#0066ff',
        color: '#fff',
        textDecoration: 'none',
        textAlign: 'center',
        padding: '10px',
        borderRadius: '8px',
        fontWeight: 'bold',
        fontSize: '14px'
    },

    mainContainer: { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '50px 20px', backgroundColor: '#000000' },
    heroSection: { textAlign: 'center', maxWidth: '850px', marginBottom: '45px', padding: '0 10px' },
    heroTitle: { fontSize: '42px', fontWeight: 'bold', marginBottom: '16px', letterSpacing: '1px' },
    heroSub: { color: '#bbb', fontSize: '15px', lineHeight: '1.7', letterSpacing: '0.3px' },
    cardsGrid: { display: 'flex', gap: '20px', justifyContent: 'center', flexWrap: 'wrap', width: '100%', maxWidth: '1250px', padding: '20px', backgroundColor: '#141414', borderRadius: '8px' },

    cardLinkWrapper: { display: 'block', width: '270px', textDecoration: 'none', maxWidth: '100%' },
    card: { height: '320px', backgroundColor: '#000', borderRadius: '8px', overflow: 'hidden', display: 'flex', flexDirection: 'column', transition: 'transform 0.25s ease, box-shadow 0.25s ease', border: '1px solid #222' },

    cardImageArea: { width: '100%', height: '100%', flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
    squareImage: { width: '100%', height: '100%', objectFit: 'cover' },

    cardFooter: { height: '60px', backgroundColor: '#000', display: 'flex', alignItems: 'center', paddingLeft: '20px', boxSizing: 'border-box' },
    cardText: { color: '#ffffff', textDecoration: 'underline', fontSize: '17px', fontWeight: 'bold', letterSpacing: '0.5px' }
};

export default App;