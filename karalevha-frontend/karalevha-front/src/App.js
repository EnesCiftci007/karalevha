import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link } from 'react-router-dom';
import Kayit from './views/kayit';
import Giris from './views/giris';
import BaskiDukkani from './views/BaskiDukkani';
import Forum from './views/Forum';
import Uye from './views/uye';
import YoneticiSayfasi from './views/YoneticiSayfasi';

const Navbar = ({ user, onLogout }) => {
    return (
        <nav style={styles.navbar}>
            <div style={styles.logoAlani}>
                <Link to="/" style={styles.navLinkLogo}>
                    <span style={{ fontWeight: 'bold', fontSize: '24px' }}>KaraLevha</span>
                </Link>
            </div>

            <div style={styles.navLinks}>
                <Link to="/" style={styles.navLink}>Ana Sayfa</Link>
                <Link to="/baski-dukkani" style={styles.navLink}>Baskı Dükkanı</Link>
                <Link to="/e-kutuphane" style={styles.navLink}>E-Kütüphane</Link>
                <Link to="/forum" style={styles.navLink}>Forum</Link>

                {/* 2. Sadece admin rolü veya badge'i olanların görebileceği buton */}
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

const AnaSayfa = () => {
    return (
        <div style={styles.mainContainer}>
            <div style={styles.heroSection}>
                <h1 style={styles.heroTitle}>Hoş Geldin!</h1>
                <p style={styles.heroSub}>
                    Karalevha, açık kaynak paylaşımını temel alan bir platformdur. 3D Baskı Dükkanı üzerinden projeleriniz için baskı hizmeti alabilir, E-Kütüphane kısmından teknik şema ve dokümanlara ulaşabilir, Forum alanında ise diğer makerlar ile fikir alışverişinde bulunabilirsiniz.
                </p>
            </div>

            <div style={styles.cardsGrid}>
                <div style={{ ...styles.card, border: '1px solid #d35400' }}>
                    <div style={{ ...styles.cardImageArea, backgroundColor: '#d35400', backgroundImage: 'radial-gradient(circle, #e67e22 10%, transparent 11%)', backgroundSize: '12px 12px' }}>
                        <div style={styles.iconMock}>𖖨️🛠️</div>
                    </div>
                    <div style={styles.cardFooter}>
                        <Link to="/baski-dukkani" style={styles.cardLink}>Baskı Dükkanı</Link>
                    </div>
                </div>

                <div style={{ ...styles.card, border: '1px solid #27ae60' }}>
                    <div style={{ ...styles.cardImageArea, backgroundColor: '#27ae60', backgroundImage: 'linear-gradient(45deg, #2ecc71 12%, transparent 12%)', backgroundSize: '15px 15px' }}>
                        <div style={styles.iconMock}>📖🔍</div>
                    </div>
                    <div style={styles.cardFooter}>
                        <Link to="/e-kutuphane" style={styles.cardLink}>E-Kütüphane</Link>
                    </div>
                </div>

                <div style={{ ...styles.card, border: '1px solid #2980b9' }}>
                    <div style={{ ...styles.cardImageArea, backgroundColor: '#2980b9', backgroundImage: 'radial-gradient(circle, #3498db 8%, transparent 9%)', backgroundSize: '16px 16px' }}>
                        <div style={styles.iconMock}>💬📌</div>
                    </div>
                    <div style={styles.cardFooter}>
                        <Link to="/forum" style={styles.cardLink}>Forum</Link>
                    </div>
                </div>
            </div>
        </div>
    );
};

const HazirlaniyorSayfasi = ({ sayfaAdi }) => (
    <div style={styles.pageContainer}>
        <h2 style={{ fontSize: '32px', color: '#f1c40f', marginBottom: '15px' }}>🚧 {sayfaAdi}</h2>
        <h3 style={{ fontSize: '24px', color: '#fff', marginBottom: '10px' }}>Bu Sayfa Hazırlanıyor...</h3>
        <p style={{ color: '#aaa', fontSize: '16px', marginBottom: '30px' }}>
            Karalevha üretim motorları bu bölümü inşa etmek için çalışıyor. Çok yakında buradayız!
        </p>
        <Link to="/" style={styles.backBtn}>Ana Sayfaya Dön</Link>
    </div>
);

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
                    <Route path="/baski-dukkani" element={<BaskiDukkani />} />
                    <Route path="/e-kutuphane" element={<HazirlaniyorSayfasi sayfaAdi="E-Kütüphane" />} />
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
    navLinkLogo: { color: '#fff', textDecoration: 'none', letterSpacing: '0.5px' },
    navLinks: { display: 'flex', alignItems: 'center', gap: '25px' },
    navLink: { color: '#fff', textDecoration: 'none', fontSize: '14px' },
    loginLink: { color: '#fff', textDecoration: 'none', fontSize: '14px', display: 'flex', alignItems: 'center' },

    // 4. Admin Buton Stili (Endüstriyel kırmızı çerçeve)
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
    card: { width: '280px', height: '320px', backgroundColor: '#000', borderRadius: '4px', overflow: 'hidden', display: 'flex', flexDirection: 'column' },
    cardImageArea: { flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', position: 'relative' },
    iconMock: { fontSize: '40px', color: '#fff', filter: 'drop-shadow(0px 4px 6px rgba(0,0,0,0.4))' },
    cardFooter: { height: '60px', backgroundColor: '#000', display: 'flex', alignItems: 'center', paddingLeft: '20px' },
    cardLink: { color: '#fff', textDecoration: 'none', fontSize: '18px', fontWeight: 'bold', letterSpacing: '0.5px' },
    pageContainer: { display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '75vh', textAlign: 'center', padding: '0 20px' },
    backBtn: { color: '#000', backgroundColor: '#fff', textDecoration: 'none', padding: '10px 20px', borderRadius: '4px', fontWeight: 'bold', fontSize: '14px' }
};

export default App;