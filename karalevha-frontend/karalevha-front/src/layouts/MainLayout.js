import React from 'react';
import Navbar from '../components/Navbar';

export default function MainLayout({ children }) {
    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            minHeight: '100vh',
            backgroundColor: '#1e1e24',
            color: '#fff',
            fontFamily: '"Segoe UI", Tahoma, Geneva, Verdana, sans-serif'
        }}>
            {/* Üst Menü Her Sayfada Sabit */}
            <Navbar />

            {/* URL'e göre değişen ana sayfa içeriği buraya enjekte edilecek */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                {children}
            </div>

            {/* Alt Bilgi (Footer) Sabit */}
            <footer style={{
                padding: '15px 40px',
                background: '#111115',
                borderTop: '1px solid #2d2d35',
                textAlign: 'center',
                fontSize: '12px',
                color: '#666'
            }}>
                © 2026 karalevha.com | Maker Üretim ve Paylaşım Platformu. Tüm hakları saklıdır.
            </footer>
        </div>
    );
}