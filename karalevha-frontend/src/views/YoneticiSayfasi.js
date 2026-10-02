import React, { useState, useEffect } from 'react';
import { API_URL } from '../config';

const YoneticiSayfasi = () => {
    const [istatistikler, setIstatistikler] = useState({ kullaniciSayisi: 0, konuSayisi: 0, baskiSayisi: 0 });
    const [filamentler, setFilamentler] = useState([]);
    const [uyeler, setUyeler] = useState([]);
    const [siparisler, setSiparisler] = useState([]);
    const [loading, setLoading] = useState(true);

    const [yeniTip, setYeniTip] = useState('PLA');
    const [yeniRenk, setYeniRenk] = useState('');
    const [yeniRenkKodu, setYeniRenkKodu] = useState('#ffffff');

    // Dinamik API Kökü (Config'ten gelir veya göreceli / olarak çalışır)
    const BASE = API_URL || '';

    const verileriYukle = async () => {
        try {
            setLoading(true);
            const statsRes = await fetch(`${BASE}/api/admin/stats`);
            setIstatistikler(await statsRes.json());

            const filRes = await fetch(`${BASE}/filaments`);
            setFilamentler(await filRes.json());

            const userRes = await fetch(`${BASE}/api/admin/users`);
            setUyeler(await userRes.json());

            const orderRes = await fetch(`${BASE}/api/admin/orders`);
            setSiparisler(await orderRes.json());
        } catch (error) {
            console.error("Veri yükleme hatası:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        verileriYukle();
    }, []);

    const filamentEkle = async (e) => {
        e.preventDefault();
        if (!yeniRenk.trim()) return alert('Renk yaz reis!');
        const payload = { id: `fil_${Date.now()}`, type: yeniTip, colorName: yeniRenk.trim(), colorHex: yeniRenkKodu, active: true };
        try {
            const res = await fetch(`${BASE}/filaments`, { method: 'POST', headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}`, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            if (res.ok) { setYeniRenk(''); verileriYukle(); }
        } catch (e) { alert("Eklenemedi"); }
    };

    const filamentSil = async (id) => {
        if (!window.confirm("Silinsin mi?")) return;
        try { await fetch(`${BASE}/filaments/${id}`, { method: 'DELETE' , headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } }); verileriYukle(); } catch (e) { }
    };

    const uyeGuncelle = async (user_id, alan, deger) => {
        const u = uyeler.find(item => item.id === user_id);
        if (!u) return;
        let r = u.role, b = u.badge;
        if (alan === 'role') { r = deger; if (deger === 'admin') b = 'Admin'; if (deger === 'user' && b === 'Admin') b = 'Maker'; }
        if (alan === 'badge') b = deger;
        try { await fetch(`${BASE}/api/admin/users/${user_id}`, { method: 'PUT', headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ role: r, badge: b }) }); verileriYukle(); } catch (e) { }
    };

    const durumGuncelle = async (order_id, yeniDurum) => {
        try {
            const res = await fetch(`${BASE}/api/admin/orders/${order_id}/status`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ durum: yeniDurum })
            });
            if (res.ok) {
                verileriYukle();
            }
        } catch (error) {
            alert("Durum güncellenemedi.");
        }
    };

    if (loading) return <div style={styles.loading}>Atölye veritabanı anlık senkronize ediliyor...</div>;

    const aktifSiparisler = siparisler.filter(o => o.durum !== 'Teslim Edildi' && o.durum !== 'İptal Edildi');
    const gecmisSiparisler = siparisler.filter(o => o.durum === 'Teslim Edildi' || o.durum === 'İptal Edildi');

    const getDurumRenk = (durum) => {
        if (durum === 'Sipariş Alındı') return '#8c52ff'; // Mor
        if (durum === 'Hazırlanıyor') return '#f39c12';
        if (durum === 'Kargoya Verildi') return '#9b59b6';
        if (durum === 'Teslim Edildi') return '#27ae60';
        return '#c0392b';
    };

    return (
        <div style={styles.container}>
            <div style={styles.header}>
                <h1 style={styles.title}>⚙️ KaraLevha Yönetim Merkezi</h1>
                <p style={styles.subtitle}>Atölye operasyonlarını, kuyruk durumlarını ve geçmiş arşivi buradan yönetebilirsin.</p>
            </div>

            {/* İSTATİSTİKLER */}
            <div style={styles.grid}>
                <div style={{ ...styles.kart, borderLeft: '4px solid #8c52ff' }}><h3 style={styles.kartBaslik}>Toplam Üye</h3><p style={styles.kartSayi}>{istatistikler.kullaniciSayisi}</p></div>
                <div style={{ ...styles.kart, borderLeft: '4px solid #2ecc71' }}><h3 style={styles.kartBaslik}>Forum Konuları</h3><p style={styles.kartSayi}>{istatistikler.konuSayisi}</p></div>
                <div style={{ ...styles.kart, borderLeft: '4px solid #f39c12' }}><h3 style={styles.kartBaslik}>Aktif Üretim Kuyruğu</h3><p style={styles.kartSayi}>{istatistikler.baskiSayisi}</p></div>
            </div>

            {/* ENERJİ ODALARI */}
            <div style={styles.anaIcerikGrid}>
                <div style={styles.SolBlok}>
                    <h2 style={styles.sectionTitle}>🧵 Filament Yönetimi</h2>
                    <form onSubmit={filamentEkle} style={styles.formContainer}>
                        <div style={styles.formSatir}>
                            <div style={{ flex: 1 }}><select style={styles.input} value={yeniTip} onChange={(e) => setYeniTip(e.target.value)}><option value="PLA">PLA</option><option value="PETG">PETG</option></select></div>
                            <div style={{ flex: 2 }}><input type="text" style={styles.input} placeholder="Renk İsmi" value={yeniRenk} onChange={(e) => setYeniRenk(e.target.value)} /></div>
                            <div style={{ flex: 1 }}><input type="color" style={styles.colorInput} value={yeniRenkKodu} onChange={(e) => setYeniRenkKodu(e.target.value)} /></div>
                        </div>
                        <button type="submit" style={styles.ekleBtn}>Sisteme Çak</button>
                    </form>
                    <div style={styles.listeBox}>
                        {filamentler.map(f => (
                            <div key={f.id} style={styles.filamentSatirKart}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}><span style={{ ...styles.renkYuvarlak, backgroundColor: f.colorHex, border: f.colorHex === '#ffffff' ? '1px solid #444' : 'none' }}></span><span style={{ ...styles.tipBadge, backgroundColor: f.type === 'PLA' ? '#8c52ff' : '#2980b9' }}>{f.type}</span><span style={styles.beyazYazi}>{f.colorName}</span></div>
                                <button style={styles.silLinkBtn} onClick={() => filamentSil(f.id)}>Kaldır</button>
                            </div>
                        ))}
                    </div>
                </div>

                <div style={styles.SagBlok}>
                    <h2 style={styles.sectionTitle}>👥 Üye Yetki ve Rozet Kontrolü</h2>
                    <div style={styles.listeBox}>
                        {uyeler.map(u => (
                            <div key={u.id} style={styles.uyeSatirKart}>
                                <div style={{ flex: 1 }}><div style={styles.beyazYazi}>{u.name}</div><div style={styles.griMetin}>{u.email}</div></div>
                                <div style={styles.aksiyonAlani}>
                                    <select style={styles.selectAyar} value={u.role} onChange={(e) => uyeGuncelle(u.id, 'role', e.target.value)}><option value="user">User</option><option value="admin">Admin</option></select>
                                    <select style={styles.selectAyar} value={u.badge} onChange={(e) => uyeGuncelle(u.id, 'badge', e.target.value)}><option value="Maker">Maker</option><option value="Pro Maker">Pro Maker</option><option value="Tasarımcı">Tasarımcı</option><option value="Admin">Admin</option></select>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* AKTİF ÜRETİM KUYRUĞU PANELİ */}
            <div style={{ ...styles.sectionContainer, marginTop: '40px' }}>
                <h2 style={styles.sectionTitle}>📥 Üretim Kuyruğu (Aktif Baskı Siparişleri)</h2>
                {aktifSiparisler.length === 0 ? (
                    <p style={styles.bosMetin}>Aktif üretim emri bulunmuyor reis.</p>
                ) : (
                    <div style={styles.siparisKuyrugu}>
                        {aktifSiparisler.map((order) => {
                            let sepet = []; try { sepet = JSON.parse(order.sepet_icerigi); } catch (e) { }
                            return (
                                <div key={order.id} style={styles.siparisAnaKart}>
                                    <div style={styles.siparisHeader}>
                                        <div>
                                            <span style={styles.siparisNo}>Sipariş #{order.id}</span>
                                            <span style={styles.siparisTarih}>{new Date(order.tarih).toLocaleString('tr-TR')}</span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                            <span style={{ ...styles.durumYaziAyar, color: getDurumRenk(order.durum) }}>● {order.durum}</span>
                                            <select
                                                style={styles.durumSelect}
                                                value={order.durum}
                                                onChange={(e) => durumGuncelle(order.id, e.target.value)}
                                            >
                                                <option value="Sipariş Alındı">Sipariş Alındı</option>
                                                <option value="Hazırlanıyor">Hazırlanıyor</option>
                                                <option value="Kargoya Verildi">Kargoya Verildi</option>
                                                <option value="Teslim Edildi">✅ Teslim Edildi (Arşive Taşı)</option>
                                                <option value="İptal Edildi">❌ Siparişi İptal Et</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div style={styles.siparisDetayGrid}>
                                        <div style={styles.detaySutun}>
                                            <h5 style={styles.detayLabel}>Müşteri Künyesi</h5>
                                            <p style={styles.detayText}><b>İsim:</b> {order.isim}</p>
                                            <p style={styles.detayText}><b>Tel:</b> {order.telefon}</p>
                                            <p style={styles.detayText}><b>E-Posta:</b> <span style={{ color: '#fff' }}>{order.eposta || 'Belirtilmedi'}</span></p>
                                            <p style={styles.detayText}><b>Tercih Kanalı:</b> <span style={{ color: '#8c52ff', fontWeight: 'bold' }}>{order.iletisim_tercihi || 'WhatsApp'}</span></p>
                                        </div>
                                        <div style={{ ...styles.detaySutun, flex: 2 }}>
                                            <h5 style={styles.detayLabel}>Lojistik ve Konum</h5>
                                            <p style={styles.detayText}><b>Yöntem:</b> {order.teslimat_yontemi === 'kargo' ? '📦 Adrese Kargo' : '🤝 Atölyeden Elden Teslim'}</p>
                                            <p style={styles.detayText}><b>Koordinat/Adres:</b> {order.adres}</p>
                                        </div>
                                        <div style={{ ...styles.detaySutun, textAlign: 'right', justifyContent: 'center' }}>
                                            <h5 style={styles.detayLabel}>Tutar</h5>
                                            <h2 style={styles.siparisFiyat}>{order.toplam_fiyat ? order.toplam_fiyat.toFixed(2) : '0.00'} TL</h2>
                                        </div>
                                    </div>

                                    {(order.not || order.notlar || order.uretim_notu) && (
                                        <div style={styles.notArayuzu}>
                                            <span style={{ fontWeight: 'bold', color: '#8c52ff' }}>📝 Atölye Üretim Notu: </span>
                                            <span style={{ color: '#ddd', fontStyle: 'italic' }}>
                                                "{order.not || order.notlar || order.uretim_notu}"
                                            </span>
                                        </div>
                                    )}

                                    <div style={styles.sepetMasa}>
                                        {sepet.map((parca, pIndex) => (
                                            <div key={pIndex} style={styles.parcaSatir}>
                                                <div style={{ flex: 2, display: 'flex', alignItems: 'center', gap: '10px' }}><span style={styles.parcaIndis}>🧩</span><span style={styles.beyazYazi}>{parca.isim}</span></div>
                                                <div style={{ flex: 1, color: '#8c52ff', fontSize: '13px', fontWeight: 'bold' }}>{parca.tur} ({parca.renk})</div>
                                                <div style={{ flex: 0.5, color: '#888', fontSize: '13px' }}>{parca.hacim}</div>
                                                <div style={{ flex: 1, textAlign: 'right' }}><a href={parca.fileUrl} download={parca.isim} style={styles.downloadLinkBtn}>⬇️ STL İndir</a></div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* GEÇMİŞ SİPARİŞLER (ARŞİV) PANELİ */}
            <div style={{ ...styles.sectionContainer, marginTop: '40px', border: '1px solid #1c1c1c' }}>
                <h2 style={{ ...styles.sectionTitle, color: '#666' }}>📁 Geçmiş Siparişler (Arşivlenmiş Kayıtlar)</h2>
                {gecmisSiparisler.length === 0 ? (
                    <p style={styles.bosMetin}>Arşivde kayıtlı işlem bulunmuyor.</p>
                ) : (
                    <div style={styles.siparisKuyrugu}>
                        {gecmisSiparisler.map((order) => {
                            return (
                                <div key={order.id} style={{ ...styles.siparisAnaKart, opacity: 0.4, backgroundColor: '#050505' }}>
                                    <div style={styles.siparisHeader}>
                                        <div>
                                            <span style={{ ...styles.siparisNo, color: '#888' }}>Sipariş #{order.id}</span>
                                            <span style={styles.siparisTarih}>{new Date(order.tarih).toLocaleString('tr-TR')}</span>
                                        </div>
                                        <div>
                                            <span style={{ ...styles.durumYaziAyar, color: getDurumRenk(order.durum), fontWeight: 'bold' }}>
                                                {order.durum === 'Teslim Edildi' ? '✓ Teslim Edildi' : '✕ İptal Edildi'}
                                            </span>
                                        </div>
                                    </div>

                                    <div style={styles.siparisDetayGrid}>
                                        <div style={styles.detaySutun}>
                                            <p style={styles.detayText}><b>Müşteri:</b> {order.isim} ({order.telefon}) | {order.eposta}</p>
                                        </div>
                                        <div style={{ ...styles.detaySutun, flex: 2 }}>
                                            <p style={styles.detayText}><b>Adres/Yöntem:</b> {order.adres}</p>
                                        </div>
                                        <div style={{ ...styles.detaySutun, textAlign: 'right' }}>
                                            <span style={{ color: '#888', fontSize: '16px', fontWeight: 'bold' }}>{order.toplam_fiyat ? order.toplam_fiyat.toFixed(2) : '0.00'} TL</span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};

const styles = {
    container: { padding: '40px 60px', backgroundColor: '#000', minHeight: '85vh', fontFamily: 'Arial, sans-serif' },
    header: { marginBottom: '40px', borderBottom: '1px solid #111', paddingBottom: '20px' },
    title: { fontSize: '32px', fontWeight: 'bold', color: '#fff', marginBottom: '10px' },
    subtitle: { color: '#666', fontSize: '14px' },
    grid: { display: 'flex', gap: '20px', marginBottom: '40px', flexWrap: 'wrap' },
    kart: { backgroundColor: '#0a0a0a', padding: '20px', borderRadius: '4px', minWidth: '200px', flex: 1, border: '1px solid #161616' },
    kartBaslik: { color: '#555', fontSize: '13px', marginBottom: '8px', textTransform: 'uppercase', fontWeight: 'bold' },
    kartSayi: { color: '#fff', fontSize: '28px', fontWeight: 'bold' },
    anaIcerikGrid: { display: 'flex', gap: '30px', flexWrap: 'wrap' },
    SolBlok: { flex: 1, minWidth: '400px', backgroundColor: '#0a0a0a', padding: '25px', borderRadius: '4px', border: '1px solid #161616' },
    SagBlok: { flex: 1, minWidth: '400px', backgroundColor: '#0a0a0a', padding: '25px', borderRadius: '4px', border: '1px solid #161616' },
    sectionContainer: { backgroundColor: '#0a0a0a', padding: '25px', borderRadius: '4px', border: '1px solid #161616' },
    sectionTitle: { color: '#fff', fontSize: '18px', marginBottom: '20px', borderBottom: '1px solid #161616', paddingBottom: '10px', fontWeight: 'bold' },
    formContainer: { backgroundColor: '#000', padding: '15px', borderRadius: '4px', border: '1px solid #161616', marginBottom: '20px' },
    formSatir: { display: 'flex', gap: '15px', marginBottom: '15px', alignItems: 'center' },
    input: { backgroundColor: '#0a0a0a', color: '#fff', border: '1px solid #222', padding: '10px', borderRadius: '4px', fontSize: '14px', width: '100%', boxSizing: 'border-box', outline: 'none' },
    colorInput: { backgroundColor: 'transparent', border: 'none', width: '100%', height: '40px', cursor: 'pointer', padding: 0 },
    ekleBtn: { backgroundColor: '#8c52ff', color: '#fff', border: 'none', padding: '10px 15px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px', width: '100%' },
    listeBox: { display: 'flex', flexDirection: 'column', gap: '10px' },
    filamentSatirKart: { backgroundColor: '#000', padding: '12px 15px', borderRadius: '4px', border: '1px solid #161616', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    renkYuvarlak: { width: '16px', height: '16px', borderRadius: '50%', display: 'inline-block' },
    tipBadge: { color: '#fff', padding: '3px 8px', borderRadius: '3px', fontSize: '11px', fontWeight: 'bold' },
    beyazYazi: { color: '#fff', fontSize: '14px', fontWeight: '500' },
    griMetin: { color: '#555', fontSize: '12px', marginTop: '2px' },
    silLinkBtn: { backgroundColor: 'transparent', color: '#c0392b', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold' },
    uyeSatirKart: { backgroundColor: '#000', padding: '15px', borderRadius: '4px', border: '1px solid #161616', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '15px' },
    aksiyonAlani: { display: 'flex', gap: '10px' },
    selectAyar: { backgroundColor: '#0a0a0a', color: '#fff', border: '1px solid #222', padding: '6px 10px', borderRadius: '4px', fontSize: '13px', cursor: 'pointer', outline: 'none' },
    siparisKuyrugu: { display: 'flex', flexDirection: 'column', gap: '20px' },
    siparisAnaKart: { backgroundColor: '#000', border: '1px solid #161616', borderRadius: '6px', padding: '20px' },
    siparisHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #161616', paddingBottom: '10px', marginBottom: '15px' },
    siparisNo: { color: '#fff', fontSize: '16px', fontWeight: 'bold', marginRight: '15px' },
    siparisTarih: { color: '#444', fontSize: '12px' },
    siparisDetayGrid: { display: 'flex', gap: '20px', flexWrap: 'wrap', marginBottom: '15px' },
    detaySutun: { flex: 1, minWidth: '150px', display: 'flex', flexDirection: 'column', gap: '5px' },
    detayLabel: { color: '#555', margin: 0, textTransform: 'uppercase', fontSize: '11px', fontWeight: 'bold', letterSpacing: '0.5px' },
    detayText: { color: '#bbb', margin: 0, fontSize: '13px' },
    siparisFiyat: { color: '#27ae60', margin: 0, fontSize: '24px', fontWeight: 'bold' },
    notArayuzu: { backgroundColor: '#111', padding: '12px 15px', borderRadius: '4px', borderLeft: '3px solid #8c52ff', fontSize: '13px', marginBottom: '15px' },
    sepetMasa: { backgroundColor: '#050505', border: '1px solid #111', borderRadius: '4px', padding: '15px' },
    parcaSatir: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #111', gap: '15px' },
    downloadLinkBtn: { display: 'inline-block', backgroundColor: '#8c52ff', color: '#fff', textDecoration: 'none', fontSize: '12px', fontWeight: 'bold', padding: '6px 12px', borderRadius: '4px', transition: '0.2s' },
    bosMetin: { color: '#444', fontStyle: 'italic', padding: '10px', margin: 0 },
    loading: { padding: '60px', color: '#fff', backgroundColor: '#000', minHeight: '85vh', fontSize: '16px' },
    durumYaziAyar: { fontSize: '13px', fontWeight: 'bold', marginRight: '10px' },
    durumSelect: { backgroundColor: '#0a0a0a', color: '#fff', border: '1px solid #222', padding: '6px 12px', borderRadius: '4px', fontSize: '13px', cursor: 'pointer', outline: 'none' }
};

export default YoneticiSayfasi;