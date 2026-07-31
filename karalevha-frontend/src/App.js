import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import Kayit from './views/kayit';
import Giris from './views/giris';
import BaskiIstasyonu from './views/BaskiIstasyonu';
import Forum from './views/Forum';
import Uye from './views/uye';
import YoneticiSayfasi from './views/YoneticiSayfasi';
import EKutuphane from './views/EKutuphane';
import { API_URL } from './config';

// 📂 Görsel ve Logo Importları
import logoPna from './assets/logo.png';
import forumGorseli from './assets/forum.png';
import kutuphaneGorseli from './assets/kutuphane.png';
import baskiGorseli from './assets/baski.png';

const Navbar = ({ user, onLogout }) => {
    const location = useLocation();

    // 🎯 Aktif sekmeyi konuyla alakalı özel renklerle işaretleyen dinamik fonksiyon
    const getNavLinkStyle = (path) => {
        const isActive = location.pathname === path;

        let activeColor = '#ffffff'; // Varsayılan (Ana Sayfa)
        if (path === '/forum') activeColor = '#780000';         // Forum: Kırmızı
        if (path === '/e-kutuphane') activeColor = '#007800';    // E-Kütüphane: Yeşil
        if (path === '/baski-istasyonu') activeColor = '#780078'; // 3B Baskı İstasyonu: Mor

        return {
            ...styles.navLink,
            color: isActive ? activeColor : '#fff',
            fontWeight: isActive ? 'bold' : 'normal',
            borderBottom: isActive ? `2px solid ${activeColor}` : '2px solid transparent',
            paddingBottom: '5px',
            transition: '0.2s'
        };
    };

    return (
        <nav style={styles.navbar}>
            {/* 🎯 Logo ve Yazıyı kusursuz şekilde dikeyde ortalayan ve yakınlaştıran alan */}
            <div style={styles.logoAlani}>
                <Link to="/" style={styles.navLinkLogo}>
                    <img src={logoPna} alt="Logo" style={styles.logoImage} onError={(e) => e.target.style.display = 'none'} />
                    <span style={styles.logoText}>KaraLevha</span>
                </Link>
            </div>

            <div style={styles.navLinks}>
                <Link to="/" style={getNavLinkStyle('/')}>Ana Sayfa</Link>
                <Link to="/forum" style={getNavLinkStyle('/forum')}>Forum</Link>
                <Link to="/e-kutuphane" style={getNavLinkStyle('/e-kutuphane')}>E-Kütüphane</Link>
                <Link to="/baski-istasyonu" style={getNavLinkStyle('/baski-istasyonu')}>3B Baskı İstasyonu</Link>

                {/* Sadece admin rolü veya badge'i olanların görebileceği buton */}
                {user && (user.role === 'admin' || user.badge === 'Admin') && (
                    <Link to="/admin" style={styles.adminNavLink}>
                        ⚙️ Admin Paneli
                    </Link>
                )}

                {user ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginLeft: '10px' }}>
                        <Link to="/uye" style={styles.profileNavBlock}>
                            {user.profile_image ? (
                                <img src={user.profile_image} alt="PP" style={styles.miniAvatar} />
                            ) : (
                                <span style={{ fontSize: '16px' }}>👤</span>
                            )}
                            <span style={styles.welcomeText}>{user.display_name}</span>
                            <span style={styles.miniBadge}>{user.badge || 'Maker'}</span>
                        </Link>
                        <button onClick={onLogout} style={styles.logoutBtn}>Çıkış</button>
                    </div>
                ) : (
                    <Link to="/giris" style={styles.loginLink}>
                        <span style={{ fontSize: '18px', marginRight: '5px' }}>👤</span> Giriş
                    </Link>
                )}
            </div>
        </nav>
    );
};

// Fare ile üzerine gelindiğinde etkileşim sağlayan akıllı kart bileşeni
const HoverCard = ({ to, imageSrc, altText, label }) => {
    const [isHovered, setIsHovered] = useState(false);

    return (
        <Link
            to={to}
            style={styles.cardLinkWrapper}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <div style={{
                ...styles.card,
                transform: isHovered ? 'translateY(-6px)' : 'translateY(0)',
                boxShadow: isHovered ? '0 10px 20px rgba(255,255,255,0.08)' : 'none'
            }}>
                <div style={styles.cardImageArea}>
                    <img src={imageSrc} alt={altText} style={styles.squareImage} />
                </div>
                <div style={styles.cardFooter}>
                    <div style={styles.cardText}>{label}</div>
                </div>
            </div>
        </Link>
    );
};

const AnaSayfa = () => {
    return (
        <div style={styles.mainContainer}>
            <div style={styles.heroSection}>
                <h1 style={styles.heroTitle}>Hoş Geldin!</h1>
                <p style={styles.heroSub}>
                    Karalevha, açık kaynak paylaşımını temel alan bir platformdur. 3B Baskı İstasyonu üzerinden projeleriniz için endüstriyel analiz ve baskı hizmeti alabilir, E-Kütüphane kısmından teknik şema ve dokümanlara ulaşabilir, Forum alanında ise diğer makerlar ile fikir alışverişinde bulunabilirsiniz.
                </p>
            </div>

            {/* ANA SAYFA KARTLARI GRIDI (Büyük Gri Arka Plan) */}
            <div style={styles.cardsGrid}>
                <HoverCard to="/forum" imageSrc={forumGorseli} altText="Forum" label="Forum" />
                <HoverCard to="/e-kutuphane" imageSrc={kutuphaneGorseli} altText="E-Kütüphane" label="E-Kütüphane" />
                <HoverCard to="/baski-istasyonu" imageSrc={baskiGorseli} altText="3B Baskı İstasyonu" label="3B Baskı İstasyonu" />
            </div>
        </div>
    );
};

function App() {
    const [user, setUser] = useState(null);

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

    return (
        <Router>
            <div style={{ backgroundColor: '#000000', minHeight: '100vh', color: '#fff', fontFamily: 'Arial, sans-serif' }}>
                <Navbar user={user} onLogout={handleLogout} />

                <Routes>
                    <Route path="/" element={<AnaSayfa />} />
                    <Route path="/kayit" element={<Kayit />} />
                    <Route path="/giris" element={<Giris />} />
                    <Route path="/baski-istasyonu" element={<BaskiIstasyonu />} />
                    <Route path="/e-kutuphane" element={<EKutuphane />} />
                    <Route path="/forum" element={<Forum />} />
                    <Route path="/uye" element={<Uye />} />
                    <Route path="/admin" element={<YoneticiSayfasi />} />
                    <Route path="*" element={<Navigate to="/" />} />
                </Routes>
            </div>
        </Router>
    );
}

const styles = {
    navbar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 60px', backgroundColor: '#000000', borderBottom: '1px solid #111' },
    logoAlani: { display: 'flex', alignItems: 'center' },

    // 🎯 gap: '6px' ile yaklaştırdık, alignItems: 'center' ile hayali ortalama çizgisini eşitledik
    navLinkLogo: { display: 'flex', alignItems: 'center', gap: '6px', color: '#fff', textDecoration: 'none', letterSpacing: '0.5px' },
    logoImage: { width: '32px', height: '32px', objectFit: 'contain', display: 'block' },
    logoText: { fontWeight: 'bold', fontSize: '24px', color: '#ffffff', lineHeight: '1' }, // Yazı yüksekliği hizalama için eşitlendi

    navLinks: { display: 'flex', alignItems: 'center', gap: '25px' },
    navLink: { color: '#fff', textDecoration: 'none', fontSize: '14px' },
    loginLink: { color: '#fff', textDecoration: 'none', fontSize: '14px', display: 'flex', alignItems: 'center' },

    adminNavLink: { color: '#e74c3c', textDecoration: 'none', fontSize: '14px', fontWeight: 'bold', backgroundColor: '#1a0d0d', padding: '6px 12px', borderRadius: '4px', border: '1px solid #c0392b', transition: '0.2s', marginRight: '5px' },

    profileNavBlock: { display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none', cursor: 'pointer', backgroundColor: '#111', padding: '5px 12px', borderRadius: '4px', border: '1px solid #222' },
    miniAvatar: { width: '22px', height: '22px', borderRadius: '50%', objectFit: 'cover', border: '1px solid #444' },
    welcomeText: { color: '#fff', fontSize: '14px', fontWeight: 'bold' },
    miniBadge: { backgroundColor: '#1e272e', border: '1px solid #34495e', color: '#3498db', padding: '2px 6px', borderRadius: '10px', fontSize: '10px', fontWeight: 'bold' },

    logoutBtn: { backgroundColor: '#e74c3c', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' },
    mainContainer: { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '60px 20px', backgroundColor: '#000000' },
    heroSection: { textAlign: 'center', maxWidth: '850px', marginBottom: '50px' },
    heroTitle: { fontSize: '48px', fontWeight: 'bold', marginBottom: '20px', letterSpacing: '1px' },
    heroSub: { color: '#bbb', fontSize: '15px', lineHeight: '1.7', letterSpacing: '0.3px' },
    cardsGrid: { display: 'flex', gap: '25px', justifyContent: 'center', flexWrap: 'wrap', width: '100%', maxWidth: '1000px', padding: '20px', backgroundColor: '#1c1c1c', borderRadius: '4px' },

    cardLinkWrapper: { display: 'block', width: '280px', textDecoration: 'none' },
    card: { height: '320px', backgroundColor: '#000', borderRadius: '4px', overflow: 'hidden', display: 'flex', flexDirection: 'column', transition: 'transform 0.25s ease, box-shadow 0.25s ease' },

    cardImageArea: { width: '100%', height: '100%', flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
    squareImage: { width: '100%', height: '100%', objectFit: 'cover' },

    cardFooter: { height: '60px', backgroundColor: '#000', display: 'flex', alignItems: 'center', paddingLeft: '20px', boxSizing: 'border-box' },
    cardText: { color: '#ffffff', textDecoration: 'underline', fontSize: '18px', fontWeight: 'bold', letterSpacing: '0.5px' }
};

export default App;