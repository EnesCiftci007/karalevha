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

            {/* ORTA TARAF: SAYFA LİNKLERİ (Sıralama: Ana Sayfa, Forum, E-Kütüphane, 3B Baskı İstasyonu) */}
            <div style={{ display: 'flex', gap: '30px', alignItems: 'center' }}>
                <Link to="/" style={linkStyle('/')}>Ana Sayfa</Link>

                {/* Forum modülü */}
                <Link to="/forum" style={linkStyle('/forum')} onClick={(e) => { e.preventDefault(); alert("Forum modülü yakında Karalevha'da aktif olacak!"); }}>Forum</Link>

                {/* E-Kütüphane Bağlantısı */}
                <Link to="/kutuphane" style={linkStyle('/kutuphane')}>E-Kütüphane</Link>

                {/* 3B Baskı İstasyonu (Router yapındaki mevcut '/baski' path'i ile tam senkronize edildi) */}
                <Link to="/baski" style={linkStyle('/baski')}>3B Baskı İstasyonu</Link>
            </div>

            {/* SAĞ TARAF: KULLANICI ALANI */}
            <div style={{ fontSize: '14px', color: '#aaa' }}>
                <span>Atölye Sistemi Aktif</span>
            </div>
        </nav>
    );
}