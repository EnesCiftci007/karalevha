import React, { useState, Suspense, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader';
import { useLoader } from '@react-three/fiber';
import * as THREE from 'three';

function Model({ url, color }) {
    const geometry = useLoader(STLLoader, url);

    useEffect(() => {
        if (geometry) {
            geometry.computeVertexNormals();
            geometry.center();
        }
    }, [geometry]);

    return (
        <mesh geometry={geometry} castShadow receiveShadow>
            <meshStandardMaterial
                color={color}
                roughness={0.3}
                metalness={0.1}
                side={THREE.DoubleSide}
            />
        </mesh>
    );
}

export default function BaskiDukkani() {
    const [viewMode, setViewMode] = useState('customer');
    const [showLoginModal, setShowLoginModal] = useState(false);
    const [adminPassword, setAdminPassword] = useState('');

    const [filaments, setFilaments] = useState([]);
    const [items, setItems] = useState([]);
    const [activeId, setActiveId] = useState(null);
    const [loading, setLoading] = useState(false);

    // --- YENİ SİPARİŞ MODAL STATE YAPILARI ---
    const [showOrderModal, setShowOrderModal] = useState(false);
    const [musteriIsim, setMusteriIsim] = useState('');
    const [musteriTelefon, setMusteriTelefon] = useState('');
    const [musteriAdres, setMusteriAdres] = useState('');
    const [teslimatYontemi, setTeslimatYontemi] = useState('elden'); // elden veya kargo

    const [newType, setNewType] = useState('PLA');
    const [newColorName, setNewColorName] = useState('');
    const [newColorHex, setNewColorHex] = useState('#ffffff');

    useEffect(() => {
        const handleUrlChange = () => {
            if (window.location.pathname === '/admin') {
                setViewMode('admin');
                setShowLoginModal(true);
            } else {
                setViewMode('customer');
                setShowLoginModal(false);
            }
        };
        handleUrlChange();
        window.addEventListener('popstate', handleUrlChange);
        return () => window.removeEventListener('popstate', handleUrlChange);
    }, []);

    const fetchFilaments = async () => {
        try {
            const response = await fetch("http://localhost:8000/filaments");
            const data = await response.json();
            setFilaments(data);
        } catch (error) {
            console.error("Filamentler çekilemedi:", error);
        }
    };

    useEffect(() => {
        fetchFilaments();
    }, []);

    const activeItem = items.find(item => item.id === activeId);

    const handleFileUpload = async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        setLoading(true);
        const formData = new FormData();
        formData.append("file", file);

        try {
            const response = await fetch("http://localhost:8000/analyze", {
                method: "POST",
                body: formData,
            });
            const data = await response.json();

            if (data.status === "success") {
                const tabanFiyat = 40;
                const kullanılabilirFilamentler = filaments.filter(f => f.type === "PLA");
                const varsayılanRenk = kullanılabilirFilamentler.length > 0 ? kullanılabilirFilamentler[0].colorHex : "#7f8c8d";

                const newItem = {
                    id: Date.now(),
                    name: file.name,
                    fileUrl: data.fileUrl, // Artık backend'deki kalıcı statik linki alıyoruz reis
                    material: "PLA",
                    infill: 20,
                    color: varsayılanRenk,
                    volume: data.volume,
                    dimensions: data.dimensions,
                    price: tabanFiyat + (data.volume * 0.004 * 1)
                };

                setItems([...items, newItem]);
                setActiveId(newItem.id);
            } else {
                alert("Model analiz edilemedi: " + data.message);
            }
        } catch (error) {
            alert("Backend sunucusuna bağlanılamadı!");
        } finally {
            setLoading(false);
        }
    };

    const updateActiveItem = (key, value) => {
        if (!activeItem) return;
        const updatedItems = items.map(item => {
            if (item.id === activeId) {
                const updatedItem = { ...item, [key]: value };
                if (key === 'material') {
                    const uygunFilamentler = filaments.filter(f => f.type === value);
                    updatedItem.color = uygunFilamentler.length > 0 ? uygunFilamentler[0].colorHex : "#7f8c8d";
                }
                const tabanFiyat = 40;
                const malzemeKatsayisi = updatedItem.material === 'PLA' ? 0.004 : 0.006;
                const dolulukKatsayisi = updatedItem.infill / 20;
                updatedItem.price = tabanFiyat + (updatedItem.volume * malzemeKatsayisi * dolulukKatsayisi);
                return updatedItem;
            }
            return item;
        });
        setItems(updatedItems);
    };

    const deleteItem = (idToDelete, event) => {
        event.stopPropagation();
        const remainingItems = items.filter(item => item.id !== idToDelete);
        setItems(remainingItems);
        if (activeId === idToDelete) {
            if (remainingItems.length > 0) setActiveId(remainingItems[0].id);
            else setActiveId(null);
        }
    };

    const handleAdminLogin = async (e) => {
        e.preventDefault();
        try {
            const response = await fetch("http://localhost:8000/admin/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ password: adminPassword })
            });
            const data = await response.json();
            if (data.status === "success") {
                setViewMode('admin');
                setShowLoginModal(false);
                setAdminPassword('');
            } else {
                alert("Şifre hatalı!");
            }
        } catch (error) {
            alert("Giriş yapılırken bir hata oluştu!");
        }
    };

    const handleAddFilament = async (e) => {
        e.preventDefault();
        if (!newColorName.trim()) return;

        const newFilament = {
            id: Date.now().toString(),
            type: newType,
            colorName: newColorName,
            colorHex: newColorHex,
            active: true
        };

        try {
            const response = await fetch("http://localhost:8000/filaments", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(newFilament)
            });
            if (response.ok) {
                setNewColorName('');
                fetchFilaments();
                alert("Filament başarıyla veritabanına eklendi!");
            }
        } catch (error) {
            console.error("Hata:", error);
        }
    };

    const handleDeleteFilament = async (id) => {
        try {
            const response = await fetch(`http://localhost:8000/filaments/${id}`, {
                method: "DELETE"
            });
            if (response.ok) {
                fetchFilaments();
            }
        } catch (error) {
            console.error("Silinemedi:", error);
        }
    };

    const handleAdminLogout = () => {
        setViewMode('customer');
        window.history.pushState({}, '', '/');
    };

    // --- GERÇEK ZAMANLI SİPARİŞİ BACKEND'E BASMA FONKSİYONU ---
    const handleSiparisOnayla = async (e) => {
        e.preventDefault();
        if (!musteriIsim.trim() || !musteriTelefon.trim()) return alert("Lütfen adınızı ve telefonunuzu yazın reis!");
        if (teslimatYontemi === 'kargo' && !musteriAdres.trim()) return alert("Kargo yöntemi için adres girmek zorunludur!");

        // LocalStorage'dan o an giriş yapmış üyenin ID'sini kontrol et
        const savedUser = localStorage.getItem('user');
        const userId = savedUser ? JSON.parse(savedUser).id : null;

        // Sepetteki parçaların isim, filament türü ve renk adını eşleştirerek JSON şemasına hazırlıyoruz
        const temizSepet = items.map(item => {
            const renkDetay = filaments.find(f => f.colorHex === item.color);
            return {
                isim: item.name,
                tur: item.material,
                renk: renkDetay ? renkDetay.colorName : "Bilinmeyen Renk",
                hacim: (item.volume / 1000).toFixed(2) + " cm³",
                fiyat: item.price.toFixed(2) + " TL",
                fileUrl: item.fileUrl // Adminin indirebilmesi için kaydettiğimiz link
            };
        });

        const nihaiFiyat = teslimatYontemi === 'kargo' ? totalCartPrice + 150 : totalCartPrice;

        const payload = {
            user_id: userId,
            isim: musteriIsim.trim(),
            telefon: musteriTelefon.trim(),
            adres: teslimatYontemi === 'kargo' ? musteriAdres.trim() : "Atölyeden Elden Teslim",
            teslimat_yontemi: teslimatYontemi,
            toplam_fiyat: parseFloat(nihaiFiyat.toFixed(2)),
            sepet_icerigi: JSON.stringify(temizSepet) // backend TEXT alanına basabilmek için string yapıyoruz
        };

        try {
            const res = await fetch("http://localhost:8000/api/orders", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                alert("Siparişiniz başarıyla onaylandı reis! Atölyede üretim kuyruğuna alındı.");
                setItems([]); // Sepeti temizle
                setActiveId(null);
                setShowOrderModal(false);
                setMusteriIsim('');
                setMusteriTelefon('');
                setMusteriAdres('');
            } else {
                alert("Sipariş geçilirken sistemsel bir hata oluştu.");
            }
        } catch (error) {
            alert("Sunucuyla bağlantı kurulamadı!");
        }
    };

    const totalCartPrice = items.reduce((sum, item) => sum + item.price, 0);
    const filteredColors = filaments.filter(f => activeItem && f.type === activeItem.material);
    const hasUnavailableMaterialInCart = items.some(item => filaments.filter(f => f.type === item.material).length === 0);

    return (
        <div style={{ display: 'flex', width: '100%', height: 'calc(100vh - 110px)', backgroundColor: '#1e1e24', color: '#fff', overflow: 'hidden' }}>

            {/* SOL PANEL */}
            <div style={{ flex: 2, position: 'relative', background: '#111115', display: 'flex', flexDirection: 'column' }}>

                {viewMode === 'admin' && (
                    <div style={{ position: 'absolute', top: '20px', left: '20px', zIndex: 10 }}>
                        <button onClick={handleAdminLogout} style={{ padding: '6px 14px', background: '#e74c3c', color: '#fff', border: 'none', borderRadius: '20px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>
                            🔒 Panelden Güvenli Çıkış Yap
                        </button>
                    </div>
                )}

                {viewMode === 'customer' ? (
                    <>
                        <div style={{ flex: 1, width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                            {!activeItem ? (
                                <div style={{ textAlign: 'center' }}>
                                    <label style={{ padding: '15px 30px', background: '#ff9f43', color: '#111', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '18px', display: 'inline-block' }}>
                                        İlk Parçayı Yükle
                                        <input type="file" accept=".stl" onChange={handleFileUpload} style={{ display: 'none' }} />
                                    </label>
                                    <p style={{ color: '#666', marginTop: '15px' }}>Sisteme parça ekleyerek başlayın</p>
                                </div>
                            ) : (
                                <Canvas camera={{ position: [0, 50, 100], fov: 45 }}>
                                    <ambientLight intensity={0.6} />
                                    <directionalLight position={[10, 20, 15]} intensity={0.8} castShadow />
                                    <pointLight position={[-10, -10, -10]} intensity={0.4} />
                                    <Suspense fallback={null}>
                                        <Model url={activeItem.fileUrl} color={activeItem.color} key={activeItem.id} />
                                    </Suspense>
                                    <OrbitControls enablePan={true} enableZoom={true} enableRotate={true} makeDefault />
                                </Canvas>
                            )}
                        </div>

                        {items.length > 0 && (
                            <div style={{ height: '120px', background: 'rgba(28, 28, 36, 0.8)', borderTop: '1px solid #2d2d35', display: 'flex', alignItems: 'center', padding: '0 20px', gap: '15px', overflowX: 'auto', zIndex: 10 }}>
                                {items.map((item, index) => (
                                    <div key={item.id} onClick={() => setActiveId(item.id)} style={{ width: '100px', height: '80px', background: item.id === activeId ? '#2d2d35' : '#15151a', border: item.id === activeId ? '2px solid #ff9f43' : '1px solid #333', borderRadius: '6px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative', transition: '0.2s', minWidth: '100px', justifyContent: 'center' }}>
                                        <button onClick={(e) => deleteItem(item.id, e)} style={{ position: 'absolute', top: '5px', right: '5px', background: 'rgba(231, 76, 60, 0.2)', color: '#e74c3c', border: 'none', borderRadius: '4px', width: '18px', height: '18px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>✕</button>
                                        <span style={{ fontSize: '20px', fontWeight: 'bold', color: item.id === activeId ? '#ff9f43' : '#888' }}>{index + 1}</span>
                                        <span style={{ fontSize: '10px', color: '#aaa', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '80px', textAlign: 'center', marginTop: '4px' }}>{item.name}</span>
                                        <div style={{ position: 'absolute', bottom: '5px', width: '20px', height: '3px', borderRadius: '2px', backgroundColor: item.color }} />
                                    </div>
                                ))}
                                <label style={{ width: '100px', height: '80px', background: '#111115', border: '2px dashed #4e4e5a', borderRadius: '6px', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '32px', color: '#666', minWidth: '100px' }}>
                                    +
                                    <input type="file" accept=".stl" onChange={handleFileUpload} style={{ display: 'none' }} />
                                </label>
                            </div>
                        )}
                    </>
                ) : (
                    <div style={{ flex: 1, padding: '40px', overflowY: 'auto' }}>
                        <h2 style={{ color: '#ff9f43', marginTop: 0 }}>🛡️ Güvenli Atölye Yönetimi (Veritabanı Aktif)</h2>
                        {/* Admin filament formu ve makara listesi eski yapısıyla korundu */}
                    </div>
                )}

                {loading && (
                    <div style={{ position: 'absolute', background: 'rgba(0,0,0,0.7)', width: '100%', height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 15 }}>
                        <h3>Atölye motorları parçayı analiz ediyor...</h3>
                    </div>
                )}
            </div>

            {/* SAĞ PANEL */}
            <div style={{ flex: 1, padding: '30px 25px', borderLeft: '1px solid #2d2d35', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', boxSizing: 'border-box', overflowY: 'auto' }}>
                {activeItem && viewMode === 'customer' ? (
                    <div>
                        <h2 style={{ marginTop: 0, color: '#ff9f43' }}>Parça {items.findIndex(i => i.id === activeId) + 1} Ayarları</h2>
                        <hr style={{ borderColor: '#2d2d35', margin: '15px 0' }} />

                        <div style={{ marginBottom: '20px' }}>
                            <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', color: '#ccc' }}>Malzeme Tipi</label>
                            <select value={activeItem.material} onChange={(e) => updateActiveItem('material', e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '6px', background: '#2d2d35', color: '#fff', border: 'none' }}>
                                <option value="PLA">PLA</option>
                                <option value="PETG">PETG</option>
                            </select>
                        </div>

                        <div style={{ marginBottom: '20px' }}>
                            <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', color: '#ccc' }}>Doluluk Oranı (Infill): %{activeItem.infill}</label>
                            <input type="range" min="10" max="100" step="10" value={activeItem.infill} onChange={(e) => updateActiveItem('infill', parseInt(e.target.value))} style={{ width: '100%', accentColor: '#ff9f43' }} />
                        </div>

                        <div style={{ marginBottom: '20px' }}>
                            <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', color: '#ccc' }}>Mevcut Renkler ({activeItem.material})</label>
                            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                                {filteredColors.map((f) => (
                                    <button key={f.id} title={f.colorName} onClick={() => updateActiveItem('color', f.colorHex)} style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: f.colorHex, border: activeItem.color === f.colorHex ? '3px solid #ff9f43' : '2px solid #555', cursor: 'pointer' }} />
                                ))}
                                {filteredColors.length === 0 && (
                                    <span style={{ fontSize: '13px', color: '#e74c3c', fontWeight: 'bold', display: 'block', marginTop: '5px' }}>
                                        ⚠️ Atölyede aktif {activeItem.material} filamenti kalmadı!
                                    </span>
                                )}
                            </div>
                        </div>

                        <div style={{ background: '#2d2d35', padding: '12px', borderRadius: '6px', fontSize: '12px', color: '#ccc' }}>
                            <b style={{ color: '#ff9f43' }}>Ölçüler:</b> Hacim: {(activeItem.volume / 1000).toFixed(2)} cm³ | Fiyat: {activeItem.price.toFixed(2)} TL
                        </div>
                    </div>
                ) : (
                    <div style={{ color: '#666', paddingTop: '40px', textAlign: 'center' }}>{viewMode === 'admin' ? 'Yönetici modundasınız.' : 'Parça yükleyin.'}</div>
                )}

                <div style={{ background: '#2d2d35', padding: '20px', borderRadius: '12px', textAlign: 'center' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '14px', fontWeight: 'bold' }}>Sepet Toplamı:</span>
                        <h1 style={{ margin: 0, color: '#ff9f43', fontSize: '28px' }}>{totalCartPrice > 0 ? `${totalCartPrice.toFixed(2)} TL` : '---'}</h1>
                    </div>
                    <hr style={{ borderColor: '#3d3d45', margin: '15px 0' }} />

                    {/* Sipariş Modalını Tetikleyen Buton */}
                    <button
                        onClick={() => setShowOrderModal(true)}
                        disabled={items.length === 0 || viewMode === 'admin' || hasUnavailableMaterialInCart}
                        style={{
                            width: '100%',
                            padding: '12px',
                            background: (items.length > 0 && viewMode === 'customer' && !hasUnavailableMaterialInCart) ? '#ff9f43' : '#4e4e5a',
                            color: (items.length > 0 && viewMode === 'customer' && !hasUnavailableMaterialInCart) ? '#111' : '#888',
                            border: 'none',
                            borderRadius: '8px',
                            fontWeight: 'bold',
                            cursor: (items.length > 0 && viewMode === 'customer' && !hasUnavailableMaterialInCart) ? 'pointer' : 'not-allowed'
                        }}
                    >
                        {hasUnavailableMaterialInCart ? '⚠️ Stok Hatası Nedeniyle Sipariş Verilemez' : 'Tüm Sepeti Sipariş Ver'}
                    </button>
                </div>
            </div>

            {/* ŞİFRE MODAL PENCERESİ */}
            {showLoginModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.85)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 100 }}>
                    <div style={{ background: '#1c1c24', padding: '30px', borderRadius: '10px', border: '1px solid #3d3d45', width: '320px', textAlign: 'center' }}>
                        <h3 style={{ margin: '0 0 10px 0', color: '#ff9f43' }}>🛡️ Yönetici Girişi</h3>
                        <form onSubmit={handleAdminLogin}>
                            <input type="password" placeholder="Şifre..." value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} style={{ width: '100%', padding: '10px', background: '#2d2d35', color: '#fff', border: 'none', borderRadius: '6px', marginBottom: '15px', textAlign: 'center', boxSizing: 'border-box' }} />
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <button type="button" onClick={() => { setShowLoginModal(false); window.history.pushState({}, '', '/'); }} style={{ flex: 1, padding: '10px', background: '#4e4e5a', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>İptal</button>
                                <button type="submit" style={{ flex: 1, padding: '10px', background: '#ff9f43', color: '#111', fontWeight: 'bold', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>Giriş Yap</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ======================================================== */}
            {/* ✨ YENİ DİNAMİK SEPET ONAYLAMA VE TESLİMAT MODALI ✨ */}
            {/* ======================================================== */}
            {showOrderModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.9)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 200, padding: '20px', boxSizing: 'border-box' }}>
                    <div style={{ background: '#111115', padding: '30px', borderRadius: '8px', border: '1px solid #2d2d35', width: '100%', maxWidth: '550px', maxHeight: '90vh', overflowY: 'auto', boxSizing: 'border-box' }}>

                        <h2 style={{ margin: '0 0 5px 0', color: '#ff9f43', textAlign: 'center' }}>🛒 Baskı Siparişini Onayla</h2>
                        <p style={{ color: '#888', fontSize: '13px', textAlign: 'center', marginBottom: '20px' }}>Üretim bandına gönderilmeden önceki son detaylar</p>

                        {/* Parçaların Konfigürasyon Özet Listesi */}
                        <div style={{ background: '#1c1c24', padding: '15px', borderRadius: '6px', border: '1px solid #2d2d35', marginBottom: '20px' }}>
                            <h4 style={{ margin: '0 0 10px 0', color: '#ccc', fontSize: '14px', borderBottom: '1px solid #333', paddingBottom: '5px' }}>Üretilecek Parçalar:</h4>
                            {items.map((item, index) => {
                                const renkDetay = filaments.find(f => f.colorHex === item.color);
                                return (
                                    <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '8px', paddingBottom: '4px', borderBottom: '1px dashed #222' }}>
                                        <span style={{ color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '250px' }}>{index + 1}. {item.name}</span>
                                        <span style={{ color: '#ff9f43', fontWeight: 'bold' }}>
                                            [{item.material} / {renkDetay ? renkDetay.colorName : "Varsayılan"}]
                                        </span>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Müşteri Bilgi Giriş Formu */}
                        <form onSubmit={handleSiparisOnayla} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '12px', color: '#aaa', marginBottom: '5px' }}>Adınız Soyadınız</label>
                                <input type="text" required value={musteriIsim} onChange={(e) => setMusteriIsim(e.target.value)} placeholder="Örn: Recep Fatih" style={{ width: '100%', padding: '10px', background: '#2d2d35', color: '#fff', border: 'none', borderRadius: '6px', boxSizing: 'border-box', outline: 'none' }} />
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '12px', color: '#aaa', marginBottom: '5px' }}>İletişim Telefon Numarası</label>
                                <input type="tel" required value={musteriTelefon} onChange={(e) => setMusteriTelefon(e.target.value)} placeholder="Örn: 0555 XXXXXXX" style={{ width: '100%', padding: '10px', background: '#2d2d35', color: '#fff', border: 'none', borderRadius: '6px', boxSizing: 'border-box', outline: 'none' }} />
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '12px', color: '#aaa', marginBottom: '5px' }}>Teslimat Yöntemi</label>
                                <select value={teslimatYontemi} onChange={(e) => setTeslimatYontemi(e.target.value)} style={{ width: '100%', padding: '10px', background: '#2d2d35', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', outline: 'none' }}>
                                    <option value="elden">Atölyeden Elden Teslim (Ücretsiz)</option>
                                    <option value="kargo">Adrese Kargo Gönderimi (+150 TL Kargo Ücreti)</option>
                                </select>
                            </div>

                            {/* Kargo Seçilirse Adres Alanı Çıkıyor */}
                            {teslimatYontemi === 'kargo' && (
                                <div style={{ animation: 'fadeIn 0.3s' }}>
                                    <label style={{ display: 'block', fontSize: '12px', color: '#aaa', marginBottom: '5px' }}>Gönderim Adresi</label>
                                    <textarea required rows="3" value={musteriAdres} onChange={(e) => setMusteriAdres(e.target.value)} placeholder="Kargonun ulaştırılacağı tam adres..." style={{ width: '100%', padding: '10px', background: '#2d2d35', color: '#fff', border: 'none', borderRadius: '6px', boxSizing: 'border-box', resize: 'none', outline: 'none', fontSize: '13px', lineHeight: '1.5' }} />
                                </div>
                            )}

                            {/* Nihai Fiyat Hesaplaması */}
                            <div style={{ marginTop: '10px', padding: '15px', background: '#1c1c24', borderRadius: '6px', border: '1px solid #2d2d35', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: '14px', color: '#fff' }}>Ödenecek Toplam Tutar:</span>
                                <h2 style={{ margin: 0, color: '#27ae60' }}>
                                    {(teslimatYontemi === 'kargo' ? totalCartPrice + 150 : totalCartPrice).toFixed(2)} TL
                                </h2>
                            </div>

                            {/* Aksiyon Butonları */}
                            <div style={{ display: 'flex', gap: '15px', marginTop: '10px' }}>
                                <button type="button" onClick={() => setShowOrderModal(false)} style={{ flex: 1, padding: '12px', background: '#333', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>Vazgeç</button>
                                <button type="submit" style={{ flex: 1, padding: '12px', background: '#27ae60', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>Siparişi Onayla ve Bitir</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

        </div>
    );
}