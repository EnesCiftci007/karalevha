import React from 'react';
import { Link, useLocation } from 'react-router-dom';

export default function Navbar() {
    const location = useLocation();

    // Aktif sayfayı belirleyip menüde altını çizmek için ufak bir stil kontrolü
    const linkStyle = (path) => ({
        color: location.pathname === path ? '#ff9f43' : '#ccc',
        textDecoration: 'none',
        fontSize: '15px',
        fontWeight: 'bold',
        transition: '0.2s',
        borderBottom: location.pathname === path ? '2px solid #ff9f43' : '2px solid transparent',
        paddingBottom: '5px'
    });

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

            {/* ORTA TARAF: SAYFA LİNKLERİ (İleride forum vb. buraya eklenecek) */}
            <div style={{ display: 'flex', gap: '30px' }}>
                <Link to="/" style={linkStyle('/')}>Ana Sayfa</Link>
                <Link to="/baski" style={linkStyle('/baski')}>3D Baskı Hizmeti</Link>
                <Link to="/forum" style={linkStyle('/forum')} onClick={(e) => { e.preventDefault(); alert("Forum modülü yakında Karalevha'da aktif olacak!"); }}>Forum</Link>
            </div>

            {/* SAĞ TARAF: KULLANICI ALANI (Şimdilik boş, üyelikte burayı dolduracağız) */}
            <div style={{ fontSize: '14px', color: '#aaa' }}>
                <span>Atölye Sistemi Aktif</span>
            </div>
        </nav>
    );
}