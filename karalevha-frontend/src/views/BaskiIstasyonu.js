import React, { useState, Suspense, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader';
import { useLoader } from '@react-three/fiber';
import * as THREE from 'three';
import istasyonLogosu from '../assets/baskikorsanlari.png'; // İstasyon görseli
import { API_URL } from '../config';
import { useLanguage } from '../i18n/LanguageContext';

const BASE_URL = process.env.REACT_APP_API_URL || "";

function Model({ url, color }) {
    // URL'in tam adres olduğundan emin oluyoruz (STLLoader'ın bozulmasını engeller)
    const tamUrl = url.startsWith('http') ? url : `${window.location.origin}${url}`;
    const geometry = useLoader(STLLoader, tamUrl);

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

export default function BaskiIstasyonu() {
    const { t } = useLanguage();
    const [viewMode, setViewMode] = useState('customer');

    const [filaments, setFilaments] = useState([]);
    const [items, setItems] = useState([]);
    const [activeId, setActiveId] = useState(null);
    const [loading, setLoading] = useState(false);
    const [isDragging, setIsDragging] = useState(false);

    // --- SİPARİŞ MODAL VE BAŞARI EKRANI STATE YAPILARI ---
    const [showOrderModal, setShowOrderModal] = useState(false);
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [musteriIsim, setMusteriIsim] = useState('');
    const [musteriTelefon, setMusteriTelefon] = useState('');
    const [musteriEposta, setMusteriEposta] = useState('');
    const [iletisimTercihi, setIletisimTercihi] = useState('WhatsApp');
    const [musteriAdres, setMusteriAdres] = useState('');
    const [teslimatYontemi, setTeslimatYontemi] = useState('elden');
    const [productionNote, setProductionNote] = useState('');

    const [newType, setNewType] = useState('PLA');
    const [newColorName, setNewColorName] = useState('');
    const [newColorHex, setNewColorHex] = useState('#ffffff');

    useEffect(() => {
        document.title = "3B Baskı İstasyonu";
    }, []);

    useEffect(() => {
        const handleUrlChange = () => {
            if (window.location.pathname === '/admin') {
                setViewMode('admin');
            } else {
                setViewMode('customer');
            }
        };
        handleUrlChange();
        window.addEventListener('popstate', handleUrlChange);
        return () => window.removeEventListener('popstate', handleUrlChange);
    }, []);

    const fetchFilaments = async () => {
        try {
            const response = await fetch(`${BASE_URL}/filaments`);
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

    const handleDragOver = (e) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = () => {
        setIsDragging(false);
    };

    const handleDrop = async (e) => {
        e.preventDefault();
        setIsDragging(false);

        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const file = e.dataTransfer.files[0];
            if (file.name && file.name.toLowerCase().endsWith('.stl')) {
                await processFile(file);
            } else {
                alert("Lütfen sadece .stl uzantılı 3B geometrik veri yükleyin!");
            }
        }
    };

    const handleFileUpload = async (event) => {
        const file = event.target.files[0];
        if (!file) return;
        await processFile(file);
    };

    const processFile = async (file) => {
        setLoading(true);
        const formData = new FormData();
        formData.append("file", file);

        try {
            const response = await fetch(`${BASE_URL}/analyze`, {
                method: "POST",
                body: formData,
            });
            const data = await response.json();

            if (data.status === "success") {
                const kullanılabilirFilamentler = filaments.filter(f => f.type === "PLA");
                const varsayılanRenk = kullanılabilirFilamentler.length > 0 ? kullanılabilirFilamentler[0].colorHex : "#7f8c8d";

                const newItem = {
                    id: Date.now(),
                    name: file.name,
                    fileUrl: data.fileUrl,
                    material: "PLA",
                    infill: 20,
                    color: varsayılanRenk,
                    volume: data.volume,
                    dimensions: data.dimensions,
                    price: data.volume * 0.001 * 1
                };

                setItems([...items, newItem]);
                setActiveId(newItem.id);
            } else {
                alert("Model analiz edilemedi: " + data.message);
            }
        } catch (error) {
            alert("Atölye motorlarına bağlanılamadı!");
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

                const malzemeKatsayisi = updatedItem.material === 'PLA' ? 0.001 : 0.0015;
                const dolulukKatsayisi = updatedItem.infill / 20;

                updatedItem.price = updatedItem.volume * malzemeKatsayisi * dolulukKatsayisi;
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
            const response = await fetch(`${BASE_URL}/filaments`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(newFilament)
            });
            if (response.ok) {
                setNewColorName('');
                fetchFilaments();
                alert("Filament matrisi üretim bandına eklendi!");
            }
        } catch (error) {
            console.error("Hata:", error);
        }
    };

    const handleDeleteFilament = async (id) => {
        try {
            const response = await fetch(`${BASE_URL}/filaments/${id}`, {
                method: "DELETE"
            });
            if (response.ok) {
                fetchFilaments();
            }
        } catch (error) {
            console.error("Makaradan kaldırılamadı:", error);
        }
    };

    const handleAdminLogout = () => {
        setViewMode('customer');
        window.history.pushState({}, '', '/');
    };

    const handleSiparisOnayla = async (e) => {
        e.preventDefault();
        if (!musteriIsim.trim() || !musteriTelefon.trim()) return alert("Lütfen telefon bilginizi doldurun!");
        if (!musteriEposta.trim()) return alert("E-posta adresi zorunludur!");
        if (teslimatYontemi === 'kargo' && !musteriAdres.trim()) return alert("Kargo gönderimi için konum koordinatları (adres) zorunludur!");

        const savedUser = localStorage.getItem('user');
        const userId = savedUser ? JSON.parse(savedUser).id : null;

        const temizSepet = items.map(item => {
            const renkDetay = filaments.find(f => f.colorHex === item.color);
            return {
                isim: item.name,
                tur: item.material,
                renk: renkDetay ? renkDetay.colorName : "Bilinmeyen Renk",
                hacim: (item.volume / 1000).toFixed(2) + " cm³",
                fiyat: item.price.toFixed(2) + " TL",
                fileUrl: item.fileUrl
            };
        });

        const nihaiFiyat = teslimatYontemi === 'kargo' ? totalCartPrice + 200 : totalCartPrice;

        const payload = {
            user_id: userId,
            isim: musteriIsim.trim(),
            telefon: musteriTelefon.trim(),
            eposta: musteriEposta.trim(),
            adres: teslimatYontemi === 'kargo' ? musteriAdres.trim() : "İstasyondan Elden Teslim",
            teslimat_yontemi: teslimatYontemi,
            toplam_fiyat: parseFloat(nihaiFiyat.toFixed(2)),
            sepet_icerigi: JSON.stringify(temizSepet),
            iletisim_tercihi: iletisimTercihi,
            not: productionNote.trim()
        };

        try {
            const res = await fetch(`${BASE_URL}/api/orders`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                setIsSubmitted(true);
                setItems([]);
                setActiveId(null);
                setShowOrderModal(false);
                setMusteriIsim('');
                setMusteriTelefon('');
                setMusteriEposta('');
                setMusteriAdres('');
                setProductionNote('');
            } else {
                alert("Üretim emri verilirken bir hata oluştu.");
            }
        } catch (error) {
            alert("İstasyon sunucusuyla bağlantı koptu!");
        }
    };

    const totalCartPrice = items.reduce((sum, item) => sum + item.price, 0);
    const filteredColors = filaments.filter(f => activeItem && f.type === activeItem.material);
    const hasUnavailableMaterialInCart = items.some(item => filaments.filter(f => f.type === item.material).length === 0);

    if (isSubmitted) {
        return (
            <div style={{ display: 'flex', width: '100%', height: 'calc(100vh - 110px)', backgroundColor: '#1e1e24', color: '#fff', justifyContent: 'center', alignItems: 'center' }}>
                <div style={{ backgroundColor: '#111115', border: '1px solid #780078', borderRadius: '12px', padding: '40px', textAlign: 'center', maxWidth: '500px', boxShadow: '0 8px 24px rgba(120, 0, 120, 0.15)' }}>
                    <div style={{ fontSize: '64px', color: '#780078', marginBottom: '20px' }}>✓</div>
                    <h2 style={{ fontSize: '26px', marginBottom: '15px', fontWeight: 'bold', color: '#780078' }}>Baskı Talebi Başarıyla Alındı!</h2>
                    <p style={{ color: '#aaa', fontSize: '15px', lineHeight: '1.6', marginBottom: '25px' }}>
                        3B model analiziniz, atölye üretim notlarınız ve iletişim bilgileriniz ana sisteme tıkır tıkır işlendi. En kısa sürede sizinle irtibata geçeceğiz.
                    </p>
                    <div style={{ display: 'flex', gap: '15px', justifyContent: 'center' }}>
                        <button
                            onClick={() => setIsSubmitted(false)}
                            style={{ backgroundColor: '#780078', color: '#fff', border: 'none', padding: '12px 24px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', transition: 'transform 0.2s' }}
                            onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.03)'}
                            onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
                        >
                            Yeni Model Analizi Başlat
                        </button>
                        <button
                            onClick={() => window.location.href = '/'}
                            style={{ backgroundColor: 'transparent', color: '#ffffff', border: '1px solid #4e4e5a', padding: '12px 24px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}
                        >
                            İstasyondan Ayrıl
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', width: '100%', height: 'calc(100vh - 110px)', backgroundColor: '#1e1e24', color: '#fff', overflow: 'hidden' }}>

            {/* SOL PANEL */}
            <div style={{ flex: 2, position: 'relative', background: '#111115', display: 'flex', flexDirection: 'column' }}>

                {viewMode === 'admin' && (
                    <div style={{ position: 'absolute', top: '20px', left: '20px', zIndex: 10 }}>
                        <button onClick={handleAdminLogout} style={{ padding: '6px 14px', background: '#e74c3c', color: '#fff', border: 'none', borderRadius: '20px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>
                            🔒 Kontrol Panelinden Çıkış Yap
                        </button>
                    </div>
                )}

                {viewMode === 'customer' ? (
                    <>
                        <div style={{ flex: 1, width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                            {!activeItem ? (
                                <div
                                    onDragOver={handleDragOver}
                                    onDragLeave={handleDragLeave}
                                    onDrop={handleDrop}
                                    style={{
                                        width: '80%',
                                        height: '60%',
                                        maxHeight: '400px',
                                        maxWidth: '600px',
                                        boxSizing: 'border-box',
                                        border: isDragging ? '2px dashed #780078' : '2px dashed #333',
                                        backgroundColor: isDragging ? 'rgba(120, 0, 120, 0.05)' : 'transparent',
                                        borderRadius: '12px',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        transition: 'all 0.2s ease-in-out'
                                    }}
                                >
                                    <label style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                        <img
                                            src={istasyonLogosu}
                                            alt="Baskı İstasyonu Üretim Merkezi"
                                            style={{
                                                width: '140px',
                                                height: 'auto',
                                                marginBottom: '25px',
                                                objectFit: 'contain',
                                                transition: 'transform 0.2s ease',
                                            }}
                                            onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                                            onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
                                        />

                                        <div style={{ padding: '15px 30px', background: '#780078', color: '#fff', borderRadius: '8px', fontWeight: 'bold', fontSize: '18px', display: 'inline-block', boxShadow: '0 4px 15px rgba(120, 0, 120, 0.3)' }}>
                                            {isDragging ? "Modeli Buraya Bırakın!" : "İlk Modelinizi Yükleyerek Başlayın"}
                                        </div>

                                        <input type="file" accept=".stl" onChange={handleFileUpload} style={{ display: 'none' }} />
                                    </label>
                                    <p style={{ color: '#666', marginTop: '15px', fontSize: '14px' }}>
                                        {isDragging ? "Bırakıldığı an analiz matrisi çalışacak" : "Başlamak için .stl dosyanızı sürükleyin veya seçin"}
                                    </p>
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
                                    <div key={item.id} onClick={() => setActiveId(item.id)} style={{ width: '100px', height: '80px', background: item.id === activeId ? '#2d2d35' : '#15151a', border: item.id === activeId ? '2px solid #780078' : '1px solid #333', borderRadius: '6px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative', transition: '0.2s', minWidth: '100px', justifyContent: 'center' }}>
                                        <button onClick={(e) => deleteItem(item.id, e)} style={{ position: 'absolute', top: '5px', right: '5px', background: 'rgba(231, 76, 60, 0.2)', color: '#e74c3c', border: 'none', borderRadius: '4px', width: '18px', height: '18px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>✕</button>
                                        <span style={{ fontSize: '20px', fontWeight: 'bold', color: item.id === activeId ? '#780078' : '#888' }}>{index + 1}</span>
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
                    /* ADMİN GÖRÜNÜMÜ: FİLAMENT VE ENVANTER YÖNETİMİ */
                    <div style={{ flex: 1, padding: '40px', overflowY: 'auto' }}>
                        <h2 style={{ marginTop: 0, color: '#780078' }}>⚙️ Üretim İstasyonu Hammadde ve Stok Yönetimi</h2>
                        <p style={{ color: '#aaa', fontSize: '14px', marginBottom: '30px' }}>Atölyede halihazırda bulunan makaraları sisteme enjekte edin. Müşteriler sadece burada ekli olan renk ve malzemelerle üretim yaptırabilir.</p>

                        <div style={{ display: 'flex', gap: '30px', flexWrap: 'wrap' }}>
                            <form onSubmit={handleCreateFilament} style={{ flex: 1, background: '#1c1c24', padding: '25px', borderRadius: '10px', border: '1px solid #2d2d35', height: 'fit-content' }}>
                                <h3 style={{ marginTop: 0, color: '#fff', fontSize: '16px', marginBottom: '20px' }}>Yeni Filament Tanımla</h3>
                                <div style={{ marginBottom: '15px' }}>
                                    <label style={{ display: 'block', fontSize: '13px', color: '#ccc', marginBottom: '5px' }}>Polimer Tipi</label>
                                    <select value={newType} onChange={(e) => setNewType(e.target.value)} style={{ width: '100%', padding: '10px', background: '#2d2d35', color: '#fff', border: 'none', borderRadius: '6px' }}>
                                        <option value="PLA">PLA (Polilaktik Asit)</option>
                                        <option value="PETG">PETG</option>
                                    </select>
                                </div>
                                <div style={{ marginBottom: '15px' }}>
                                    <label style={{ display: 'block', fontSize: '13px', color: '#ccc', marginBottom: '5px' }}>Pigment Spektrum Adı</label>
                                    <input type="text" value={newColorName} onChange={(e) => setNewColorName(e.target.value)} placeholder="Örn: Endüstriyel Siyah" style={{ width: '100%', padding: '10px', background: '#2d2d35', color: '#fff', border: 'none', borderRadius: '6px', boxSizing: 'border-box' }} />
                                </div>
                                <div style={{ marginBottom: '20px' }}>
                                    <label style={{ display: 'block', fontSize: '13px', color: '#ccc', marginBottom: '5px' }}>Hex Kodu</label>
                                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                        <input type="color" value={newColorHex} onChange={(e) => setNewColorHex(e.target.value)} style={{ border: 'none', background: 'none', width: '50px', height: '40px', cursor: 'pointer' }} />
                                        <input type="text" value={newColorHex} onChange={(e) => setNewColorHex(e.target.value)} style={{ padding: '10px', background: '#2d2d35', color: '#fff', border: 'none', borderRadius: '6px', width: '100px', textAlign: 'center' }} />
                                    </div>
                                </div>
                                <button type="submit" style={{ width: '100%', padding: '12px', background: '#780078', color: '#fff', fontWeight: 'bold', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>Hammadde Enjeksiyonu Yap</button>
                            </form>

                            <div style={{ flex: 1.5, background: '#1c1c24', padding: '25px', borderRadius: '10px', border: '1px solid #2d2d35' }}>
                                <h3 style={{ marginTop: 0, color: '#fff', fontSize: '16px', marginBottom: '20px' }}>📦 Aktif Makaralar ({filaments.length})</h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                    {filaments.map(f => (
                                        <div key={f.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#2d2d35', padding: '12px 15px', borderRadius: '6px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                                <div style={{ width: '20px', height: '20px', borderRadius: '50%', backgroundColor: f.colorHex, border: '1px solid #fff' }} />
                                                <div><span style={{ fontWeight: 'bold', color: '#780078', marginRight: '10px' }}>[{f.type}]</span><span>{f.colorName}</span></div>
                                            </div>
                                            <button onClick={() => handleDeleteFilament(f.id)} style={{ background: 'none', color: '#e74c3c', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold' }}>Sil</button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {loading && (
                    <div style={{ position: 'absolute', background: 'rgba(0,0,0,0.7)', width: '100%', height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 15 }}>
                        <h3 style={{ color: '#780078' }}>Atölye motorları parçayı analiz ediyor...</h3>
                    </div>
                )}
            </div>

            {/* SAĞ PANEL */}
            <div style={{ flex: 1, padding: '30px 25px', borderLeft: '1px solid #2d2d35', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', boxSizing: 'border-box', overflowY: 'auto' }}>
                {activeItem && viewMode === 'customer' ? (
                    <div>
                        <h2 style={{ marginTop: 0, color: '#780078' }}>Parça {items.findIndex(i => i.id === activeId) + 1}</h2>
                        <hr style={{ borderColor: '#2d2d35', margin: '15px 0' }} />

                        <div style={{ marginBottom: '20px' }}>
                            <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', color: '#ccc' }}>{t('print_material')}</label>
                            <select value={activeItem.material} onChange={(e) => updateActiveItem('material', e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '6px', background: '#2d2d35', color: '#fff', border: 'none' }}>
                                <option value="PLA">PLA</option>
                                <option value="PETG">PETG</option>
                            </select>
                        </div>

                        <div style={{ marginBottom: '20px' }}>
                            <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', color: '#ccc' }}>{t('print_infill')}: %{activeItem.infill}</label>
                            <input type="range" min="10" max="100" step="10" value={activeItem.infill} onChange={(e) => updateActiveItem('infill', parseInt(e.target.value))} style={{ width: '100%', accentColor: '#780078' }} />
                        </div>

                        <div style={{ marginBottom: '20px' }}>
                            <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', color: '#ccc' }}>Filament ({activeItem.material})</label>
                            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                                {filteredColors.map((f) => (
                                    <button key={f.id} title={f.colorName} onClick={() => updateActiveItem('color', f.colorHex)} style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: f.colorHex, border: activeItem.color === f.colorHex ? '3px solid #780078' : '2px solid #555', cursor: 'pointer' }} />
                                ))}
                                {filteredColors.length === 0 && (
                                    <span style={{ fontSize: '13px', color: '#e74c3c', fontWeight: 'bold', display: 'block', marginTop: '5px' }}>
                                        ⚠️ İstasyonda aktif {activeItem.material} filamenti kalmadı!
                                    </span>
                                )}
                            </div>
                        </div>

                        <div style={{ background: '#2d2d35', padding: '12px', borderRadius: '6px', fontSize: '12px', color: '#ccc' }}>
                            <b style={{ color: '#780078' }}>{t('print_calculate')}:</b> Hacim: {(activeItem.volume / 1000).toFixed(2)} cm³ | {t('print_estimated_cost')}: {activeItem.price.toFixed(2)} TL
                        </div>
                    </div>
                ) : (
                    <div style={{ color: '#666', paddingTop: '40px', textAlign: 'center' }}>{viewMode === 'admin' ? 'İstasyon kontrol modundasınız.' : t('print_upload_model')}</div>
                )}

                <div style={{ background: '#2d2d35', padding: '20px', borderRadius: '12px', textAlign: 'center' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '14px', fontWeight: 'bold' }}>{t('print_estimated_cost')}:</span>
                        <h1 style={{ margin: 0, color: '#780078', fontSize: '28px' }}>{totalCartPrice > 0 ? `${totalCartPrice.toFixed(2)} TL` : '---'}</h1>
                    </div>
                    <hr style={{ borderColor: '#3d3d45', margin: '15px 0' }} />

                    <button
                        onClick={() => setShowOrderModal(true)}
                        disabled={items.length === 0 || viewMode === 'admin' || hasUnavailableMaterialInCart}
                        style={{
                            width: '100%',
                            padding: '12px',
                            background: (items.length > 0 && viewMode === 'customer' && !hasUnavailableMaterialInCart) ? '#780078' : '#4e4e5a',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '8px',
                            fontWeight: 'bold',
                            cursor: (items.length > 0 && viewMode === 'customer' && !hasUnavailableMaterialInCart) ? 'pointer' : 'not-allowed'
                        }}
                    >
                        {hasUnavailableMaterialInCart ? '⚠️ Stok Hatası: Sipariş Engellendi' : t('print_request_order')}
                    </button>
                </div>
            </div>

            {/* SEPET ONAYLAMA MODALI */}
            {showOrderModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.9)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 200, padding: '20px', boxSizing: 'border-box' }}>
                    <div style={{ background: '#111115', padding: '30px', borderRadius: '8px', border: '1px solid #2d2d35', width: '100%', maxWidth: '550px', maxHeight: '90vh', overflowY: 'auto', boxSizing: 'border-box' }}>

                        <h2 style={{ margin: '0 0 5px 0', color: '#780078', textAlign: 'center' }}>Talep / Basım Detayları</h2>
                        <p style={{ color: '#fff', fontSize: '13px', textAlign: 'center', marginBottom: '20px', lineHeight: '1.5', padding: '0 10px' }}>
                            Paylaştığınız bilgiler doğrultusunda sizinle iletişime geçilecek ve onayınızın ardından üretime başlanacaktır. İletişim kurulup mutabık kalınmadan herhangi bir ücret tahsil edilmeyecektir.
                        </p>

                        <div style={{ background: '#1c1c24', padding: '15px', borderRadius: '6px', border: '1px solid #2d2d35', marginBottom: '20px' }}>
                            <h4 style={{ margin: '0 0 10px 0', color: '#ccc', fontSize: '14px', borderBottom: '1px solid #333', paddingBottom: '5px' }}>Üretilecek Parçalar:</h4>
                            {items.map((item, index) => {
                                const renkDetay = filaments.find(f => f.colorHex === item.color);
                                return (
                                    <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '8px', paddingBottom: '4px', borderBottom: '1px dashed #222' }}>
                                        <span style={{ color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '250px' }}>{index + 1}. {item.name}</span>
                                        <span style={{ color: '#780078', fontWeight: 'bold' }}>
                                            [{item.material} / {renkDetay ? renkDetay.colorName : "Varsayılan"}]
                                        </span>
                                    </div>
                                );
                            })}
                        </div>

                        <form onSubmit={handleSiparisOnayla} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '12px', color: '#aaa', marginBottom: '5px' }}>Adınız Soyadınız</label>
                                <input type="text" required value={musteriIsim} onChange={(e) => setMusteriIsim(e.target.value)} placeholder="Örn: Emre Bütoğlu" style={{ width: '100%', padding: '10px', background: '#2d2d35', color: '#fff', border: 'none', borderRadius: '6px', boxSizing: 'border-box', outline: 'none' }} />
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '12px', color: '#aaa', marginBottom: '5px' }}>İletişim Telefon Numarası</label>
                                <input type="tel" required value={musteriTelefon} onChange={(e) => setMusteriTelefon(e.target.value)} placeholder="Örn: 0555 XXX XX XX" style={{ width: '100%', padding: '10px', background: '#2d2d35', color: '#fff', border: 'none', borderRadius: '6px', boxSizing: 'border-box', outline: 'none' }} />
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '12px', color: '#aaa', marginBottom: '5px' }}>E-Posta Adresiniz</label>
                                <input type="email" required value={musteriEposta} onChange={(e) => setMusteriEposta(e.target.value)} placeholder="Örn: karalevha@gmail.com" style={{ width: '100%', padding: '10px', background: '#2d2d35', color: '#fff', border: 'none', borderRadius: '6px', boxSizing: 'border-box', outline: 'none' }} />
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '12px', color: '#aaa', marginBottom: '5px' }}>Sizinle Nasıl İletişime Geçelim?</label>
                                <select
                                    value={iletisimTercihi}
                                    onChange={(e) => setIletisimTercihi(e.target.value)}
                                    style={{ width: '100%', padding: '10px', background: '#2d2d35', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', outline: 'none' }}
                                >
                                    <option value="WhatsApp">WhatsApp Mesajı ile</option>
                                    <option value="SMS">SMS (Kısa Mesaj) ile</option>
                                    <option value="E-posta">E-posta Göndererek</option>
                                </select>
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '12px', color: '#aaa', marginBottom: '5px' }}>Teslimat Yöntemi</label>
                                <select value={teslimatYontemi} onChange={(e) => setTeslimatYontemi(e.target.value)} style={{ width: '100%', padding: '10px', background: '#2d2d35', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', outline: 'none' }}>
                                    <option value="elden">Atölyeden Elden Teslim (Ücretsiz)</option>
                                    <option value="kargo">Adrese Kargo Gönderimi (+200 TL Kargo Ücreti)</option>
                                </select>
                            </div>

                            {teslimatYontemi === 'kargo' && (
                                <div style={{ animation: 'fadeIn 0.3s' }}>
                                    <label style={{ display: 'block', fontSize: '12px', color: '#aaa', marginBottom: '5px' }}>Gönderim Adresi</label>
                                    <textarea required rows="3" value={musteriAdres} onChange={(e) => setMusteriAdres(e.target.value)} placeholder="Kargonun ulaştırılacağı tam adres..." style={{ width: '100%', padding: '10px', background: '#2d2d35', color: '#fff', border: 'none', borderRadius: '6px', boxSizing: 'border-box', resize: 'none', outline: 'none', fontSize: '13px', lineHeight: '1.5' }} />
                                </div>
                            )}

                            <div>
                                <label style={{ display: 'block', fontSize: '12px', color: '#aaa', marginBottom: '5px' }}>Notlar:</label>
                                <textarea
                                    rows="3"
                                    value={productionNote}
                                    onChange={(e) => setProductionNote(e.target.value)}
                                    placeholder="Üretim süreçleri, topluluk bilgileri, iletişim saatleri ve eklemek istediğiniz diğer detayları burada belirtebilirsiniz."
                                    style={{ width: '100%', padding: '10px', background: '#2d2d35', color: '#fff', border: 'none', borderRadius: '6px', boxSizing: 'border-box', resize: 'none', outline: 'none', fontSize: '13px', lineHeight: '1.5' }}
                                />
                            </div>

                            <div style={{ marginTop: '10px', padding: '15px', background: '#1c1c24', borderRadius: '6px', border: '1px solid #2d2d35', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: '14px', color: '#fff' }}>Toplam Maliyet:</span>
                                <h2 style={{ margin: 0, color: '#fff' }}>
                                    {(teslimatYontemi === 'kargo' ? totalCartPrice + 200 : totalCartPrice).toFixed(2)} TL
                                </h2>
                            </div>

                            <div style={{ display: 'flex', gap: '15px', marginTop: '10px' }}>
                                <button type="button" onClick={() => setShowOrderModal(false)} style={{ flex: 1, padding: '12px', background: '#333', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>Talebi Geri Çek</button>
                                <button type="submit" style={{ flex: 1, padding: '12px', background: '#780078', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>Baskı Talebini Gönder</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

        </div>
    );
}