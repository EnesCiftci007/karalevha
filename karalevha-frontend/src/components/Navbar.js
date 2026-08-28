import React from 'react';
import { Link, useLocation } from 'react-router-dom';

export default function Navbar() {
    const location = useLocation();

    // v2.7.6: Aktif sayfaya göre dinamik renk ve alt çizgi kontrolü
    const linkStyle = (path) => {
        // Baskı istasyonu sayfası aktifse Mor çizgi çeksin, diğerlerinde Turuncu
        const isBaskiIstasyonu = path === '/baski';
        const activeColor = isBaskiIstasyonu ? '#8c52ff' : '#ff9f43';

        return {
            color: location.pathname === path ? activeColor : '#ccc',
            textDecoration: 'none',
            fontSize: '15px',
            fontWeight: 'bold',
            transition: '0.2s',
            borderBottom: location.pathname === path ? `2px solid ${activeColor}` : '2px solid transparent',
            paddingBottom: '5px'
        };
    };

    return (
        <nav style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '15px 40px',
            background: '#111115',
            borderBottom: '1px solid #2d2d35',
            boxSizing: 'border-box'
        }}>
            {/* SOL TARAF: LOGO */}
            <Link to="/" style={{ textDecoration: 'none' }}>
                <h2 style={{ margin: 0, fontSize: '22px', color: '#ff9f43', letterSpacing: '1px' }}>
                    KARA<span style={{ color: '#fff' }}>LEVHA</span>
                    <span style={{ fontSize: '11px', color: '#888', marginLeft: '10px', fontWeight: 'normal' }}>v0.4</span>
                </h2>
            </Link>

            {/* ORTA TARAF: SAYFA LİNKLERİ */}
            <div style={{ display: 'flex', gap: '30px', alignItems: 'center' }}>
                <Link to="/" style={linkStyle('/')}>Ana Sayfa</Link>
                <Link to="/forum" style={linkStyle('/forum')}>Forum</Link>
                <Link to="/baski-istasyonu" style={linkStyle('/baski-istasyonu')}>3B Baskı İstasyonu</Link>
                <Link to="/e-oba" style={linkStyle('/e-oba')}>E-Oba</Link>
            </div>

            {/* SAĞ TARAF: KULLANICI ALANI */}
            <div style={{ fontSize: '14px', color: '#aaa' }}>
                <span>Atölye Sistemi Aktif</span>
            </div>
        </nav>
    );
}