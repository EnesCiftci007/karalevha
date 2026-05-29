import React from 'react';
import { Link } from 'react-router-dom';

export default function AnaSayfa() {
    return (
        <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            padding: '40px',
            textAlign: 'center',
            background: 'radial-gradient(circle, #1e1e24 0%, #111115 100%)'
        }}>
            <h1 style={{ fontSize: '48px', color: '#ff9f43', marginBottom: '10px' }}>
                Karalevha'ya Hoş Geldiniz
            </h1>
            <p style={{ fontSize: '18px', color: '#ccc', maxWidth: '600px', lineHeight: '1.6', marginBottom: '40px' }}>
                Açık kaynak projeler, teknik dökümanlar, maker topluluğu ve tam otomatik 3D baskı hizmetinin buluştuğu merkezi üretim üssü.
            </p>

            {/* MODÜL KARTLARI */}
            <div style={{ display: 'flex', gap: '25px', marginBottom: '40px', flexWrap: 'wrap', justifyContent: 'center' }}>

                {/* 3D Baskı Kartı */}
                <div style={{ background: '#1c1c24', padding: '30px', borderRadius: '10px', border: '1px solid #ff9f43', width: '250px', textAlign: 'left' }}>
                    <h3 style={{ color: '#ff9f43', marginTop: 0 }}>⚙️ 3D Baskı Hizmeti</h3>
                    <p style={{ fontSize: '13px', color: '#aaa', minHeight: '60px' }}>STL modelinizi yükleyin, anlık hacim ve maliyet analizini yaparak siparişinizi oluşturun.</p>
                    <Link to="/baski" style={{ display: 'inline-block', background: '#ff9f43', color: '#111', padding: '8px 15px', borderRadius: '5px', textDecoration: 'none', fontWeight: 'bold', fontSize: '13px' }}>Baskı Al</Link>
                </div>

                {/* Forum Kartı */}
                <div style={{ background: '#1c1c24', padding: '30px', borderRadius: '10px', border: '1px solid #2d2d35', width: '250px', textAlign: 'left', opacity: 0.7 }}>
                    <h3 style={{ color: '#fff', marginTop: 0 }}>💬 Maker Forumu</h3>
                    <p style={{ fontSize: '13px', color: '#aaa', minHeight: '60px' }}>Teknik sorunları tartışın, projelerinizi paylaşın ve diğer maker'larla yardımlaşın.</p>
                    <span style={{ fontSize: '12px', color: '#888', fontWeight: 'bold' }}>Yakında Aktif</span>
                </div>

                {/* E-Kütüphane Kartı */}
                <div style={{ background: '#1c1c24', padding: '30px', borderRadius: '10px', border: '1px solid #2d2d35', width: '250px', textAlign: 'left', opacity: 0.7 }}>
                    <h3 style={{ color: '#fff', marginTop: 0 }}>📚 E-Kütüphane</h3>
                    <p style={{ fontSize: '13px', color: '#aaa', minHeight: '60px' }}>Filament rehberleri, 3D yazıcı kalibrasyon dökümanları ve açık kaynak kütüphane.</p>
                    <span style={{ fontSize: '12px', color: '#888', fontWeight: 'bold' }}>Yakında Aktif</span>
                </div>

            </div>
        </div>
    );
}