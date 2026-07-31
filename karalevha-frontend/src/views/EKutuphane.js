import React, { useState, useEffect } from 'react';
import { API_URL } from '../config';

// React'ın Nesne Çökme Hatasını %100 Engelleyen Güvenli Eleman Sarmalayıcı Component
const SafeItem = ({ value, fallback = "" }) => {
    if (value === null || value === undefined) return <>{fallback}</>;
    if (typeof value === 'object') {
        const safeString = value.name || value.title || value.display_name || value.email || "";
        if (safeString) return <>{String(safeString)}</>;
        return <>{fallback}</>;
    }
    return <>{String(value)}</>;
};

export default function EKutuphane() {
    const [folders, setFolders] = useState([]);
    const [files, setFiles] = useState([]);
    const [breadcrumbs, setBreadcrumbs] = useState([]);
    const [currentFolderId, setCurrentFolderId] = useState(null);
    const [loading, setLoading] = useState(false);
    const [allFoldersList, setAllFoldersList] = useState([]);

    // Modallar
    const [showFolderModal, setShowFolderModal] = useState(false);
    const [showFileModal, setShowFileModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);

    // İzin Yönetim Modalı Stateleri
    const [showPermissionModal, setShowPermissionModal] = useState(false);
    const [activePermissionFolder, setActivePermissionFolder] = useState(null);
    const [whitelistUsers, setWhitelistUsers] = useState([]);
    const [searchUserEmail, setSearchUserEmail] = useState('');

    // Formlar
    const [newFolderName, setNewFolderName] = useState('');
    const [isPrivateFolder, setIsPrivateFolder] = useState(false);
    const [selectedFile, setSelectedFile] = useState(null);

    // Sürükle-Bırak Görsel Durumu
    const [isDragging, setIsDragging] = useState(false);

    // Düzenleme Durumu
    const [editTarget, setEditTarget] = useState(null);
    const [editName, setEditName] = useState('');
    const [targetParentId, setTargetParentId] = useState('');
    const [editIsPrivate, setEditIsPrivate] = useState(false);
    const [folderToDelete, setFolderToDelete] = useState(null);

    const getCurrentUser = () => {
        try {
            const savedUser = localStorage.getItem('user');
            return savedUser ? JSON.parse(savedUser) : null;
        } catch (e) {
            return null;
        }
    };
    const currentUser = getCurrentUser();

    // Objeyi string'e güvenle çeviren düz fonksiyon
    const convertSafeString = (value, fallback = "") => {
        if (!value) return fallback;
        if (typeof value === 'object') {
            return value.name || value.title || value.display_name || fallback;
        }
        return String(value);
    };

    const fetchContents = async (folderId) => {
        setLoading(true);
        try {
            const freshUser = getCurrentUser();
            let url = `${API_URL}/api/library/contents`;
            const queryParams = [];

            if (folderId) queryParams.push(`parent_id=${folderId}`);
            if (freshUser && freshUser.id) queryParams.push(`current_user_id=${freshUser.id}`);
            if (queryParams.length > 0) url += `?${queryParams.join('&')}`;

            const response = await fetch(url);
            const data = await response.json();

            if (data && data.status === "success") {
                setFolders(Array.isArray(data.folders) ? data.folders : []);
                setFiles(Array.isArray(data.files) ? data.files : []);
                setBreadcrumbs(Array.isArray(data.breadcrumbs) ? data.breadcrumbs : []);
            } else {
                setFolders([]);
                setFiles([]);
                setBreadcrumbs([]);
            }
        } catch (error) {
            setFolders([]);
            setFiles([]);
            setBreadcrumbs([]);
        } finally {
            setLoading(false);
        }
    };

    const fetchAllFoldersFlat = async () => {
        try {
            const freshUser = getCurrentUser();
            let url = `${API_URL}/api/library/contents`;
            if (freshUser) url += `?current_user_id=${freshUser.id}`;

            const response = await fetch(url);
            const data = await response.json();
            if (data && data.status === "success" && Array.isArray(data.folders)) {
                setAllFoldersList(data.folders);
            } else {
                setAllFoldersList([]);
            }
        } catch (error) {
            setAllFoldersList([]);
        }
    };

    useEffect(() => {
        fetchContents(currentFolderId);
    }, [currentFolderId]);

    const handleCreateFolder = async (e) => {
        e.preventDefault();
        const freshUser = getCurrentUser();
        if (!newFolderName.trim() || !freshUser) return;
        try {
            await fetch(`${API_URL}/api/library/folders`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: newFolderName.trim(),
                    parent_id: currentFolderId,
                    user_id: freshUser.id,
                    is_private: isPrivateFolder ? 1 : 0
                })
            });
            setNewFolderName('');
            setIsPrivateFolder(false);
            setShowFolderModal(false);
            fetchContents(currentFolderId);
        } catch (error) { alert("Hata oluştu."); }
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file && file.size > 100 * 1024 * 1024) {
            alert("Maksimum yükleme limiti 100 MB'tır.");
            e.target.value = null;
            return;
        }
        setSelectedFile(file);
    };

    const uploadDirectFile = async (fileToUpload) => {
        const freshUser = getCurrentUser();
        if (!fileToUpload || !freshUser) return;
        const formData = new FormData();
        formData.append("folder_id", currentFolderId || 0);
        formData.append("user_id", freshUser.id);
        formData.append("file", fileToUpload);

        try {
            const response = await fetch(`${API_URL}/api/library/files`, { method: "POST", body: formData });
            if (response.ok) {
                fetchContents(currentFolderId);
            } else {
                alert("Yükleme başarısız oldu.");
            }
        } catch (error) { alert("Yükleme hatası."); }
    };

    const handleUploadFileSubmit = async (e) => {
        e.preventDefault();
        if (!selectedFile) return;
        await uploadDirectFile(selectedFile);
        setSelectedFile(null);
        setShowFileModal(false);
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        if (getCurrentUser()) setIsDragging(true);
    };

    const handleDragLeave = (e) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const handleDrop = async (e) => {
        e.preventDefault();
        setIsDragging(false);
        if (!getCurrentUser()) return;

        const droppedFiles = e.dataTransfer.files;
        if (droppedFiles && droppedFiles.length > 0) {
            const file = droppedFiles[0];
            if (file.size > 100 * 1024 * 1024) {
                alert("Maksimum yükleme limiti 100 MB'tır.");
                return;
            }
            await uploadDirectFile(file);
        }
    };

    const openEditModal = (item, type, event) => {
        event.stopPropagation();
        if (!item) return;
        setEditTarget({ type, id: item.id });
        setEditName(type === 'folder' ? convertSafeString(item.name) : convertSafeString(item.display_name));
        setTargetParentId(type === 'folder' ? String(item.parent_id || '0') : String(item.folder_id || '0'));
        if (type === 'folder') setEditIsPrivate(item.is_private === 1);
        fetchAllFoldersFlat();
        setShowEditModal(true);
    };

    const handleSaveEdit = async (e) => {
        e.preventDefault();
        const freshUser = getCurrentUser();
        if (!freshUser || !editTarget) return;

        try {
            const baseUrl = `${API_URL}/api/library/${editTarget.type === 'folder' ? 'folders' : 'files'}/${editTarget.id}`;

            const updateResponse = await fetch(`${baseUrl}/update`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: editName.trim(),
                    user_id: freshUser.id,
                    is_private: editIsPrivate ? 1 : 0
                })
            });

            if (!updateResponse.ok) {
                const errData = await updateResponse.json();
                alert(errData.detail || "Güncelleme başarısız oldu.");
                return;
            }

            const pId = targetParentId === '' || targetParentId === '0' ? null : parseInt(targetParentId);
            await fetch(`${baseUrl}/move`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ parent_id: pId, user_id: freshUser.id })
            });

            setShowEditModal(false);
            fetchContents(currentFolderId);
        } catch (error) {
            alert("Düzenleme sırasında bir hata oluştu.");
        }
    };

    const openPermissionModal = (folder, event) => {
        event.stopPropagation();
        if (!folder) return;
        setActivePermissionFolder(folder);
        setShowPermissionModal(true);
        fetchFolderWhitelist(folder.id);
    };

    const fetchFolderWhitelist = async (folderId) => {
        try {
            const response = await fetch(`${API_URL}/api/library/folders/${folderId}/permissions`);
            const data = await response.json();
            setWhitelistUsers(data && Array.isArray(data.users) ? data.users : []);
        } catch (error) { console.error(error); }
    };

    const handleAddUserToWhitelist = async (e) => {
        e.preventDefault();
        if (!searchUserEmail.trim() || !activePermissionFolder) return;
        try {
            const response = await fetch(`${API_URL}/api/library/folders/${activePermissionFolder.id}/permissions`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: searchUserEmail.trim() })
            });
            if (response.ok) {
                setSearchUserEmail('');
                fetchFolderWhitelist(activePermissionFolder.id);
            } else {
                alert("Kullanıcı bulunamadı veya yetkilendirilemedi.");
            }
        } catch (error) { alert("Hata oluştu."); }
    };

    const handleRemoveUserFromWhitelist = async (userId) => {
        if (!activePermissionFolder) return;
        try {
            await fetch(`${API_URL}/api/library/folders/${activePermissionFolder.id}/permissions/${userId}`, {
                method: "DELETE"
            });
            fetchFolderWhitelist(activePermissionFolder.id);
        } catch (error) { alert("Hata oluştu."); }
    };

    const triggerDeleteFolderConfirm = (folderId) => {
        setFolderToDelete(folderId);
        setShowDeleteConfirmModal(true);
    };

    const handleExecuteDeleteFolder = async () => {
        const freshUser = getCurrentUser();
        if (!freshUser || !folderToDelete) return;
        try {
            const response = await fetch(`${API_URL}/api/library/folders/${folderToDelete}?user_id=${freshUser.id}`, {
                method: "DELETE"
            });
            if (response.ok) {
                setShowDeleteConfirmModal(false);
                setShowEditModal(false);
                setFolderToDelete(null);
                fetchContents(currentFolderId);
            } else {
                const data = await response.json();
                alert(data.detail || "Klasör silinemedi.");
            }
        } catch (error) {
            alert("Sunucu bağlantı hatası oluştu.");
        }
    };

    const handleDeleteFile = async (fileId, event) => {
        event.stopPropagation();
        const freshUser = getCurrentUser();
        if (!freshUser || !window.confirm("Kalıcı olarak silinsin mi?")) return;
        await fetch(`${API_URL}/api/library/files/${fileId}?user_id=${freshUser.id}`, { method: "DELETE" });
        fetchContents(currentFolderId);
    };

    return (
        <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            style={{ padding: '40px', backgroundColor: '#1e1e24', minHeight: 'calc(100vh - 110px)', color: '#fff', fontFamily: 'Arial, sans-serif', position: 'relative' }}
        >
            {/* SÜRÜKLE BIRAK KATMANI */}
            {isDragging && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0, 120, 0, 0.85)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 200, pointerEvents: 'none', border: '5px dashed #fff' }}>
                    <div style={{ textAlign: 'center' }}>
                        <span style={{ fontSize: '60px' }}>📤</span>
                        <h2 style={{ color: '#fff', marginTop: '15px' }}>Dosyayı Mevcut Klasöre Yüklemek İçin Bırakın</h2>
                    </div>
                </div>
            )}

            {/* ÜST BAŞLIK ALANI */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
                <div>
                    <h1 style={{ margin: 0, color: '#007800', fontSize: '28px', fontWeight: 'bold' }}>Açık Arşiv & E-Kütüphane</h1>
                    <p style={{ margin: '5px 0 0 0', color: '#aaa', fontSize: '14px' }}>Gizli klasörler oluşturabilir ve beyaz listenizi yönetebilirsiniz.</p>
                </div>
                {currentUser && (
                    <div style={{ display: 'flex', gap: '15px' }}>
                        <button onClick={() => setShowFolderModal(true)} style={{ padding: '10px 20px', background: 'transparent', color: '#007800', border: '2px solid #007800', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', backgroundColor: 'rgba(0, 120, 0, 0.1)' }}>📁 Yeni Klasör</button>
                        <button onClick={() => setShowFileModal(true)} style={{ padding: '10px 20px', background: '#007800', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>📤 Dosya Ekle</button>
                    </div>
                )}
            </div>

            {/* BREADCRUMBS */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#111115', padding: '12px 20px', borderRadius: '6px', marginBottom: '25px', border: '1px solid #2d2d35' }}>
                <span onClick={() => setCurrentFolderId(null)} style={{ color: currentFolderId === null ? '#007800' : '#aaa', cursor: 'pointer', fontWeight: currentFolderId === null ? 'bold' : 'normal' }}>📁 Kök Dizin</span>
                {breadcrumbs.map((crumb) => {
                    if (!crumb) return null;
                    return (
                        <React.Fragment key={crumb.id}>
                            <span style={{ color: '#555' }}>/</span>
                            <span onClick={() => setCurrentFolderId(crumb.id)} style={{ color: currentFolderId === crumb.id ? '#007800' : '#aaa', cursor: 'pointer', fontWeight: currentFolderId === crumb.id ? 'bold' : 'normal' }}>
                                <SafeItem value={crumb.name} fallback="Klasör" />
                            </span>
                        </React.Fragment>
                    );
                })}
            </div>

            {loading ? <div style={{ textAlign: 'center', color: '#007800' }}><h3>Yükleniyor...</h3></div> : (
                <div>
                    {/* KLASÖRLER LİSTESİ */}
                    {folders.length > 0 && (
                        <div style={{ marginBottom: '40px' }}>
                            <h3 style={{ borderBottom: '1px solid #2d2d35', paddingBottom: '10px', color: '#ccc' }}>Klasörler</h3>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '20px', marginTop: '15px' }}>
                                {folders.map(folder => {
                                    if (!folder) return null;
                                    return (
                                        <div key={folder.id} onClick={() => setCurrentFolderId(folder.id)} style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', background: '#111115', padding: '15px', borderRadius: '8px', cursor: 'pointer', border: folder.is_private ? '1px dashed #007800' : '1px solid #2d2d35' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                    <span>{folder.is_private ? '🔒' : '📁'}</span>
                                                    <span style={{ fontWeight: 'bold', color: folder.is_private ? '#007800' : '#fff' }}>
                                                        <SafeItem value={folder.name} fallback="Klasör" />
                                                    </span>
                                                </div>

                                                {currentUser && (currentUser.id === folder.user_id || currentUser.role === 'admin') && (
                                                    <div style={{ display: 'flex', gap: '8px' }}>
                                                        {folder.is_private === 1 && (
                                                            <button onClick={(e) => openPermissionModal(folder, e)} title="Erişim İzinleri" style={{ background: 'none', border: 'none', color: '#54a0ff', cursor: 'pointer' }}>👥</button>
                                                        )}
                                                        <button onClick={(e) => openEditModal(folder, 'folder', e)} style={{ background: 'none', border: 'none', color: '#aaa', cursor: 'pointer' }}>⚙️</button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* DOSYALAR LİSTESİ */}
                    <div>
                        <h3 style={{ borderBottom: '1px solid #2d2d35', paddingBottom: '10px', color: '#ccc' }}>Dosyalar</h3>
                        {files.length === 0 ? <p style={{ color: '#666', fontStyle: 'italic' }}>Bu klasör boş. Dosyalarınızı buraya sürükleyip bırakarak da yükleyebilirsiniz.</p> : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '15px' }}>
                                {files.map(file => {
                                    if (!file) return null;
                                    return (
                                        <div key={file.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#111115', padding: '15px 20px', borderRadius: '8px', border: '1px solid #2d2d35' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                                <span style={{ fontSize: '24px' }}>📄</span>
                                                <div>
                                                    <a href={file.file_path} download target="_blank" rel="noreferrer" style={{ color: '#fff', textDecoration: 'none', fontWeight: 'bold' }}>
                                                        <SafeItem value={file.display_name} fallback="Dosya" />
                                                    </a>
                                                    <div style={{ fontSize: '12px', color: '#666' }}>Boyut: {file.file_size} MB</div>
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', gap: '10px' }}>
                                                {currentUser && (currentUser.id === file.user_id || currentUser.role === 'admin') && (
                                                    <>
                                                        <button onClick={(e) => openEditModal(file, 'file', e)} style={{ padding: '6px 12px', background: '#2d2d35', color: '#007800', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>Taşı / Düzenle</button>
                                                        <button onClick={(e) => handleDeleteFile(file.id, e)} style={{ padding: '6px 12px', background: 'rgba(231, 76, 60, 0.1)', color: '#e74c3c', border: '1px solid #e74c3c', borderRadius: '4px', cursor: 'pointer' }}>Sil</button>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* BEYAZ LİSTE / ERİŞİM İZİNLERİ MODALI */}
            {showPermissionModal && activePermissionFolder && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.85)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 130 }}>
                    <div style={{ background: '#111115', padding: '30px', borderRadius: '10px', border: '1px solid #54a0ff', width: '420px' }}>
                        <h3 style={{ margin: '0 0 10px 0', color: '#54a0ff' }}>👥 Erişim Listesi: <SafeItem value={activePermissionFolder.name} fallback="Klasör" /></h3>
                        <p style={{ fontSize: '12px', color: '#aaa', marginBottom: '20px' }}>Bu gizli klasöre erişebilecek ekip üyelerinin e-posta adreslerini ekleyin.</p>

                        <form onSubmit={handleAddUserToWhitelist} style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                            <input type="email" required placeholder="ornek@karabuk.edu.tr" value={searchUserEmail} onChange={(e) => setSearchUserEmail(e.target.value)} style={{ flex: 1, padding: '10px', background: '#2d2d35', color: '#fff', border: 'none', borderRadius: '6px' }} />
                            <button type="submit" style={{ padding: '10px 15px', background: '#54a0ff', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>Ekle</button>
                        </form>

                        <div style={{ maxHeight: '200px', overflowY: 'auto', background: '#15151a', padding: '10px', borderRadius: '6px', marginBottom: '20px' }}>
                            {whitelistUsers.length === 0 ? <p style={{ fontSize: '13px', color: '#555', textAlign: 'center', margin: '10px 0' }}>Henüz kimse eklenmedi.</p> : (
                                whitelistUsers.map(u => {
                                    if (!u) return null;
                                    return (
                                        <div key={u.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px', borderBottom: '1px solid #2d2d35' }}>
                                            <span style={{ fontSize: '14px' }}><SafeItem value={u.email} /></span>
                                            <button type="button" onClick={() => handleRemoveUserFromWhitelist(u.id)} style={{ background: 'none', border: 'none', color: '#e74c3c', cursor: 'pointer' }}>❌</button>
                                        </div>
                                    );
                                })
                            )}
                        </div>

                        <button onClick={() => { setShowPermissionModal(false); fetchContents(currentFolderId); }} style={{ width: '100%', padding: '10px', background: '#333', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>Kapat</button>
                    </div>
                </div>
            )}

            {/* YENİ KLASÖR MODALI */}
            {showFolderModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 100 }}>
                    <div style={{ background: '#111115', padding: '30px', borderRadius: '8px', border: '1px solid #2d2d35', width: '340px' }}>
                        <h3 style={{ margin: '0 0 15px 0', color: '#007800' }}>📁 Yeni Klasör Oluştur</h3>
                        <form onSubmit={handleCreateFolder}>
                            <input type="text" required placeholder="Klasör adı..." value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)} style={{ width: '100%', padding: '10px', background: '#2d2d35', color: '#fff', border: 'none', borderRadius: '6px', marginBottom: '15px', boxSizing: 'border-box' }} />

                            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', cursor: 'pointer', fontSize: '14px', color: '#ccc' }}>
                                <input type="checkbox" checked={isPrivateFolder} onChange={(e) => setIsPrivateFolder(Boolean(e.target.checked))} style={{ transform: 'scale(1.2)' }} />
                                🔒 Bu klasörü gizli yap (Özel Arşiv)
                            </label>

                            <div style={{ display: 'flex', gap: '10px' }}>
                                <button type="button" onClick={() => setShowFolderModal(false)} style={{ flex: 1, padding: '10px', background: '#333', color: '#fff', border: 'none', borderRadius: '6px' }}>İptal</button>
                                <button type="submit" style={{ flex: 1, padding: '10px', background: '#007800', color: '#fff', fontWeight: 'bold', border: 'none', borderRadius: '6px' }}>Oluştur</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* DOSYA YÜKLE MODALI */}
            {showFileModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 100 }}>
                    <div style={{ background: '#111115', padding: '30px', borderRadius: '8px', border: '1px solid #2d2d35', width: '360px' }}>
                        <h3 style={{ margin: '0 0 15px 0', color: '#007800' }}>📤 Dosya Yükle</h3>
                        <form onSubmit={handleUploadFileSubmit}>
                            <input type="file" required onChange={handleFileChange} style={{ width: '100%', padding: '10px', background: '#2d2d35', color: '#fff', border: 'none', borderRadius: '6px', marginBottom: '20px', boxSizing: 'border-box' }} />

                            <p style={{ fontSize: '12px', color: '#aaa', margin: '-10px 0 20px 0' }}>Maksimum dosya boyutu: 100 MB</p>

                            <div style={{ display: 'flex', gap: '10px' }}>
                                <button type="button" onClick={() => { setShowFileModal(false); setSelectedFile(null); }} style={{ flex: 1, padding: '10px', background: '#333', color: '#fff', border: 'none', borderRadius: '6px' }}>İptal</button>
                                <button type="submit" style={{ flex: 1, padding: '10px', background: '#007800', color: '#fff', fontWeight: 'bold', border: 'none', borderRadius: '6px' }}>Yükle</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* DÜZENLEME MODALI */}
            {showEditModal && editTarget && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 110 }}>
                    <div style={{ background: '#111115', padding: '30px', borderRadius: '8px', border: '1px solid #2d2d35', width: '380px' }}>
                        <h3 style={{ margin: '0 0 20px 0', color: '#007800' }}>⚙️ Öğe Ayarları</h3>
                        <form onSubmit={handleSaveEdit}>
                            <label style={{ fontSize: '13px', color: '#aaa', display: 'block', marginBottom: '8px' }}>Yeni İsim:</label>
                            <input type="text" required value={editName} onChange={(e) => setEditName(e.target.value)} style={{ width: '100%', padding: '10px', background: '#2d2d35', color: '#fff', border: 'none', borderRadius: '6px', marginBottom: '15px', boxSizing: 'border-box' }} />

                            {editTarget.type === 'folder' && (
                                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', cursor: 'pointer', fontSize: '14px', color: '#ccc' }}>
                                    <input type="checkbox" checked={editIsPrivate} onChange={(e) => setEditIsPrivate(Boolean(e.target.checked))} style={{ transform: 'scale(1.2)' }} />
                                    🔒 Klasör Durumunu Gizli Yap
                                </label>
                            )}

                            <label style={{ fontSize: '13px', color: '#aaa', display: 'block', marginBottom: '8px' }}>Taşınacak Hedef Klasör:</label>
                            <select value={targetParentId} onChange={(e) => setTargetParentId(e.target.value)} style={{ width: '100%', padding: '10px', background: '#2d2d35', color: '#fff', border: 'none', borderRadius: '6px', marginBottom: '25px' }}>
                                <option value="0">📁 Kök Dizin (Ana Sayfa)</option>
                                {allFoldersList && allFoldersList
                                    .filter(f => f && editTarget && (f.id !== editTarget.id || editTarget.type !== 'folder'))
                                    .map(folder => {
                                        if (!folder) return null;
                                        return (
                                            <option key={folder.id} value={folder.id}>
                                                📁 {convertSafeString(folder.name)}
                                            </option>
                                        );
                                    })}
                            </select>

                            <div style={{ display: 'flex', gap: '10px' }}>
                                {editTarget.type === 'folder' && (
                                    <button type="button" onClick={() => triggerDeleteFolderConfirm(editTarget.id)} style={{ padding: '10px', background: 'rgba(231, 76, 60, 0.2)', color: '#e74c3c', border: '1px solid #e74c3c', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
                                        Klasörü Sil
                                    </button>
                                )}
                                <button type="button" onClick={() => setShowEditModal(false)} style={{ flex: 1, padding: '10px', background: '#333', color: '#fff', border: 'none', borderRadius: '6px' }}>İptal</button>
                                <button type="submit" style={{ flex: 1, padding: '10px', background: '#007800', color: '#fff', fontWeight: 'bold', border: 'none', borderRadius: '6px' }}>Kaydet</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ÖZEL SİLME ONAY MODALI */}
            {showDeleteConfirmModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.85)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 120 }}>
                    <div style={{ background: '#15151a', padding: '30px', borderRadius: '10px', border: '1px solid #e74c3c', width: '420px', textAlign: 'center', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
                        <span style={{ fontSize: '40px', display: 'block', marginBottom: '15px' }}>⚠️</span>
                        <h3 style={{ margin: '0 0 15px 0', color: '#e74c3c', fontSize: '20px' }}>Kritik Uyarı</h3>
                        <p style={{ color: '#ddd', fontSize: '15px', lineHeight: '1.6', marginBottom: '25px' }}>
                            Bu klasörü sildiğinizde <strong>İÇİNDEKİ TÜM ALT KLASÖRLER VE DOSYALAR DA</strong> kalıcı olarak silinecektir! Emin misiniz?
                        </p>
                        <div style={{ display: 'flex', gap: '15px' }}>
                            <button onClick={() => setShowDeleteConfirmModal(false)} style={{ flex: 1, padding: '12px', background: '#2d2d35', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>İptal</button>
                            <button onClick={handleExecuteDeleteFolder} style={{ flex: 1, padding: '12px', background: '#e74c3c', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>Evet, Kalıcı Olarak Sil</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}