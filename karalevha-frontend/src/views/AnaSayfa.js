import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { API_URL } from '../config';

// Premium Landing Page
export default function AnaSayfa() {
    const [stats, setStats] = useState({ users: 0, topics: 0, prints: 0 });
    const [animatedStats, setAnimatedStats] = useState({ users: 0, topics: 0, prints: 0 });
    const user = JSON.parse(localStorage.getItem('user') || 'null');


    useEffect(() => {
        // Fetch stats
        fetch(`${API_URL}/api/admin/stats`)
            .then(res => res.json())
            .then(data => {
                // Sütun isimleri ne gelirse gelsin desteklemek için
                setStats({
                    users: data.total_users || data.users || 0,
                    topics: data.total_posts || data.posts || data.topics || 0,
                    prints: data.total_prints || data.prints || 0
                });
            })
            .catch(err => console.error("Stats fetch error:", err));
    }, []);

    // Basit bir sayaç animasyonu
    useEffect(() => {
        const duration = 2000;
        const steps = 60;
        const stepTime = duration / steps;
        
        let currentStep = 0;
        const timer = setInterval(() => {
            currentStep++;
            const progress = currentStep / steps;
            
            // Ease-out effect for a smoother look
            const easeOutProgress = 1 - Math.pow(1 - progress, 3);
            
            setAnimatedStats({
                users: Math.floor(stats.users * easeOutProgress),
                topics: Math.floor(stats.topics * easeOutProgress),
                prints: Math.floor(stats.prints * easeOutProgress)
            });

            if (currentStep >= steps) {
                setAnimatedStats(stats); // emin olmak için son değere eşitle
                clearInterval(timer);
            }
        }, stepTime);

        return () => clearInterval(timer);
    }, [stats]);

    return (
        <div style={styles.container}>
            <style>
                {`
                @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@300;500;700;900&display=swap');
                
                @keyframes fadeUp {
                    0% { opacity: 0; transform: translateY(30px); }
                    100% { opacity: 1; transform: translateY(0); }
                }

                @keyframes backgroundPan {
                    0% { background-position: 0% 50%; }
                    50% { background-position: 100% 50%; }
                    100% { background-position: 0% 50%; }
                }

                .premium-hero-title {
                    font-size: 4.5rem;
                    font-weight: 900;
                    margin-bottom: 20px;
                    background: linear-gradient(90deg, #ffffff, #666666, #ffffff);
                    background-size: 200% auto;
                    color: #fff;
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    animation: backgroundPan 4s linear infinite;
                    line-height: 1.1;
                }

                .feature-card {
                    background: rgba(15, 15, 20, 0.7);
                    border: 1px solid rgba(255,255,255,0.08);
                    border-radius: 20px;
                    padding: 40px 30px;
                    text-align: center;
                    transition: all 0.4s ease;
                    backdrop-filter: blur(10px);
                    position: relative;
                    overflow: hidden;
                    cursor: pointer;
                    display: flex;
                    flex-direction: column;
                    justify-content: space-between;
                    flex: 1;
                    min-width: 250px;
                }
                
                .feature-card:hover {
                    transform: translateY(-12px);
                }

                .feature-card.baski:hover { box-shadow: 0 20px 50px rgba(120, 0, 120, 0.25); border-color: #780078; }
                .feature-card.akis:hover { box-shadow: 0 20px 50px rgba(120, 0, 0, 0.25); border-color: #780000; }
                .feature-card.eoba:hover { box-shadow: 0 20px 50px rgba(0, 102, 255, 0.25); border-color: #0066ff; }
                
                .step-item {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 15px;
                    max-width: 280px;
                    text-align: center;
                }

                .step-icon {
                    width: 75px;
                    height: 75px;
                    border-radius: 50%;
                    background: #111;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 32px;
                    border: 2px solid #333;
                    color: #fff;
                    transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                }
                
                .step-item:hover .step-icon {
                    border-color: #fff;
                    transform: scale(1.15) rotate(5deg);
                    box-shadow: 0 0 20px rgba(255,255,255,0.2);
                }
                
                .hover-scale {
                    transition: transform 0.2s;
                }
                .hover-scale:hover {
                    transform: scale(1.05);
                }

                @media (max-width: 900px) {
                    .premium-hero-title { font-size: 3.5rem; }
                    .features-grid { flex-direction: column; }
                    .steps-container { flex-direction: column; gap: 50px; align-items: center; }
                    .stats-container { flex-direction: column; gap: 30px; }
                }
                `}
            </style>

            {/* HERO SECTION */}
            <div style={{ ...styles.section, minHeight: '85vh', justifyContent: 'center', paddingTop: '100px' }}>
                <div style={{ animation: 'fadeUp 1s ease-out', width: '100%', maxWidth: '900px' }}>
                    <h1 className="premium-hero-title">KaraLevha'ya Hoş Geldin</h1>
                    <p style={styles.heroSubtitle}>
                        Tasarla, Paylaş, Üret. Geleceğin atölyesi parmaklarının ucunda. 
                        Topluluğun gücüyle fikirlerini fiziksel gerçeğe dönüştür.
                    </p>
                    <div style={styles.heroButtons}>
                        {user ? (
                            <Link to="/akis" className="hover-scale" style={{ ...styles.btn, ...styles.btnPrimary }}>Platformda Gezin</Link>
                        ) : (
                            <Link to="/giris" className="hover-scale" style={{ ...styles.btn, ...styles.btnPrimary }}>Platforma Gir</Link>
                        )}
                        <a href="#nasil-calisir" className="hover-scale" style={{ ...styles.btn, ...styles.btnSecondary }}>Nasıl Çalışır?</a>
                    </div>
                </div>
            </div>

            {/* CANLI İSTATİSTİKLER */}
            <div style={styles.section}>
                <div className="stats-container" style={styles.statsRow}>
                    <div style={styles.statBox}>
                        <h2 style={styles.statNumber}>{animatedStats.users}+</h2>
                        <p style={styles.statLabel}>Aktif Üye</p>
                    </div>
                    <div style={styles.statBox}>
                        <h2 style={styles.statNumber}>{animatedStats.topics}+</h2>
                        <p style={styles.statLabel}>Proje & Konu</p>
                    </div>
                    <div style={styles.statBox}>
                        <h2 style={styles.statNumber}>{animatedStats.prints}+</h2>
                        <p style={styles.statLabel}>Başarılı Baskı</p>
                    </div>
                </div>
            </div>

            {/* ÖZELLİKLER - 3 KART */}
            <div style={{ ...styles.section, padding: '100px 20px' }}>
                <h2 style={styles.sectionTitle}>Neler Sunuyoruz?</h2>
                <div className="features-grid" style={styles.featuresGrid}>
                    <Link to="/baski-istasyonu" className="feature-card baski" style={{ textDecoration: 'none' }}>
                        <div>
                            <div style={{ ...styles.featureIcon, color: '#780078' }}>🖨️</div>
                            <h3 style={styles.featureTitle}>3D Baskı İstasyonu</h3>
                            <p style={styles.featureDesc}>
                                STL modellerini yükle, malzeme seç ve anında üretime gönder. Gelişmiş dilimleme ve sıfır zahmetle 3 boyutlu üretimin keyfini çıkar.
                            </p>
                        </div>
                        <div style={{ ...styles.exploreLink, color: '#d83bd8' }}>Keşfet &rarr;</div>
                    </Link>

                    <Link to="/akis" className="feature-card akis" style={{ textDecoration: 'none' }}>
                        <div>
                            <div style={{ ...styles.featureIcon, color: '#780000' }}>🔥</div>
                            <h3 style={styles.featureTitle}>Maker Akışı</h3>
                            <p style={styles.featureDesc}>
                                Canlı toplulukla etkileşime geç. Fikirlerini paylaş, sorular sor, teknik destek al ve diğer maker'ların projelerinden ilham bul.
                            </p>
                        </div>
                        <div style={{ ...styles.exploreLink, color: '#e74c3c' }}>Keşfet &rarr;</div>
                    </Link>

                    <Link to="/e-oba" className="feature-card eoba" style={{ textDecoration: 'none' }}>
                        <div>
                            <div style={{ ...styles.featureIcon, color: '#0066ff' }}>⛺</div>
                            <h3 style={styles.featureTitle}>E-Oba Atölyeleri</h3>
                            <p style={styles.featureDesc}>
                                Dijital kamp alanında yeteneklerini birleştir. Eğitimlere katıl, dökümanlar oku ve takımlarla beraber daha büyük işler başar.
                            </p>
                        </div>
                        <div style={{ ...styles.exploreLink, color: '#38bdf8' }}>Keşfet &rarr;</div>
                    </Link>
                </div>
            </div>

            {/* NASIL ÇALIŞIR */}
            <div id="nasil-calisir" style={{ ...styles.section, background: 'radial-gradient(ellipse at bottom, #0d0d12 0%, #000000 100%)', padding: '120px 20px', borderRadius: '40px', maxWidth: '100%' }}>
                <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
                    <h2 style={styles.sectionTitle}>Nasıl Çalışır?</h2>
                    <div className="steps-container" style={styles.stepsRow}>
                        <div className="step-item">
                            <div className="step-icon">1</div>
                            <h4 style={styles.stepTitle}>Hesap Aç</h4>
                            <p style={styles.stepDesc}>Saniyeler içinde aramıza katıl ve yeteneklerini sergileyeceğin, rozetler kazanacağın profilini oluştur.</p>
                        </div>
                        <div className="step-item">
                            <div className="step-icon">2</div>
                            <h4 style={styles.stepTitle}>Projenle Gel</h4>
                            <p style={styles.stepDesc}>İster 3D model, ister elektronik devren. Akışta paylaş, topluluktan hızlı geri bildirimler al.</p>
                        </div>
                        <div className="step-item">
                            <div className="step-icon">3</div>
                            <h4 style={styles.stepTitle}>Üret & Paylaş</h4>
                            <p style={styles.stepDesc}>3D baskı istasyonuyla fikirlerini fiziksel ürüne dönüştür, deneyimini paylaş ve başarılarını kutla.</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* FOOTER CALL TO ACTION */}
            <div style={{ ...styles.section, padding: '140px 20px', textAlign: 'center' }}>
                <h2 style={{ fontSize: '3.5rem', fontWeight: 800, marginBottom: '25px', letterSpacing: '-1px' }}>Sen de Aramıza Katıl</h2>
                <p style={{ color: '#999', fontSize: '1.25rem', marginBottom: '50px', maxWidth: '650px', margin: '0 auto 50px auto', lineHeight: 1.6 }}>
                    Maker ruhunu yaşatmak ve projelerini bir sonraki seviyeye taşımak için doğru yerdesin. 
                    Topluluğun parçası ol!
                </p>
                <Link to="/kayit" className="hover-scale" style={{ ...styles.btn, ...styles.btnPrimary, padding: '20px 50px', fontSize: '1.2rem' }}>
                    Kulübümüze Katıl
                </Link>
            </div>
        </div>
    );
}

const styles = {
    container: {
        width: '100%',
        minHeight: '100vh',
        backgroundColor: '#000000',
        color: '#ffffff',
        fontFamily: "'Montserrat', sans-serif",
        overflowX: 'hidden'
    },
    section: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '20px',
        textAlign: 'center'
    },
    heroSubtitle: {
        fontSize: '1.35rem',
        color: '#a1a1aa',
        maxWidth: '750px',
        margin: '0 auto 45px auto',
        lineHeight: 1.7,
        fontWeight: 400
    },
    heroButtons: {
        display: 'flex',
        gap: '20px',
        justifyContent: 'center',
        flexWrap: 'wrap'
    },
    btn: {
        padding: '16px 36px',
        borderRadius: '40px',
        fontSize: '1.05rem',
        fontWeight: 700,
        textDecoration: 'none',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer'
    },
    btnPrimary: {
        backgroundColor: '#ffffff',
        color: '#000000',
        boxShadow: '0 8px 25px rgba(255, 255, 255, 0.15)'
    },
    btnSecondary: {
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        color: '#ffffff',
        border: '1px solid rgba(255, 255, 255, 0.2)'
    },
    statsRow: {
        display: 'flex',
        justifyContent: 'space-around',
        width: '100%',
        padding: '50px 0',
        borderTop: '1px solid rgba(255, 255, 255, 0.06)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.06)'
    },
    statBox: {
        padding: '20px',
        flex: 1
    },
    statNumber: {
        fontSize: '4rem',
        fontWeight: 900,
        margin: 0,
        background: 'linear-gradient(135deg, #0066ff, #fff)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        lineHeight: 1
    },
    statLabel: {
        fontSize: '1.15rem',
        color: '#a1a1aa',
        marginTop: '15px',
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '2px'
    },
    sectionTitle: {
        fontSize: '2.8rem',
        fontWeight: 900,
        marginBottom: '70px',
        letterSpacing: '-0.5px'
    },
    featuresGrid: {
        display: 'flex',
        gap: '30px',
        width: '100%',
        alignItems: 'stretch'
    },
    featureIcon: {
        fontSize: '4.5rem',
        marginBottom: '25px',
        filter: 'drop-shadow(0 0 10px rgba(255,255,255,0.1))'
    },
    featureTitle: {
        fontSize: '1.6rem',
        fontWeight: 800,
        marginBottom: '15px',
        color: '#ffffff'
    },
    featureDesc: {
        color: '#a1a1aa',
        fontSize: '1.05rem',
        lineHeight: 1.7,
        marginBottom: '40px'
    },
    exploreLink: {
        fontSize: '1.1rem',
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '1px'
    },
    stepsRow: {
        display: 'flex',
        justifyContent: 'space-around',
        width: '100%',
        alignItems: 'flex-start'
    },
    stepTitle: {
        fontSize: '1.4rem',
        fontWeight: 800,
        color: '#ffffff',
        margin: '15px 0'
    },
    stepDesc: {
        color: '#a1a1aa',
        fontSize: '1.05rem',
        lineHeight: 1.7
    }
};