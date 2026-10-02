import React, { useState, useEffect, useRef } from 'react';
import { API_URL } from '../config';
import { useLanguage } from '../i18n/LanguageContext';
import { parseUTC } from '../config';

const PRIMARY_BLUE = '#0066ff';
const PRIMARY_BLUE_HOVER = '#0052cc';
const PRIMARY_BLUE_LIGHT = '#1e3a8a';

export default function EOba({ user }) {
    const { t } = useLanguage();
    const currentUser = user || (localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user')) : null);

    // Ana Liste ve Seçim Durumları
    const [obalar, setObalar] = useState([]);
    const [activeObaId, setActiveObaId] = useState(null);
    const [obaDetail, setObaDetail] = useState(null);
    const [tree, setTree] = useState([]);
    const [collapsedCadirlar, setCollapsedCadirlar] = useState({});
    const [collapsedMasalar, setCollapsedMasalar] = useState({});
    const [activeMasa, setActiveMasa] = useState(null);
    const [activeLevha, setActiveLevha] = useState(null);

    // Üye Listesi & Sağ Panel
    const [members, setMembers] = useState([]);
    const [showMemberSidebar, setShowMemberSidebar] = useState(true);

    // Mobil Görünüm Desteği
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
    const [mobileTab, setMobileTab] = useState('channels'); // 'channels' | 'workspace' | 'members'

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Roller
    const [roles, setRoles] = useState([]);

    // Modallar
    // 'create_oba', 'oba_settings', 'create_cadir', 'create_masa', 'create_levha', 'permissions', 'assign_role'
    const [modalType, setModalType] = useState(null);
    const [settingsTab, setSettingsTab] = useState('general'); // 'general' | 'roles' | 'danger'
    const [selectedTarget, setSelectedTarget] = useState(null); // { type: 'cadir'|'masa'|'levha', id, name }
    const [targetPerms, setTargetPerms] = useState([]);
    const [selectedMember, setSelectedMember] = useState(null);

    // Form Durumları
    const [obaForm, setObaForm] = useState({ name: '', description: '', is_public: 1 });
    const [obaSettingsForm, setObaSettingsForm] = useState({ name: '', description: '', avatar_url: '', is_public: 1 });
    const [cadirForm, setCadirForm] = useState({ name: '' });
    const [masaForm, setMasaForm] = useState({ name: '', icon: '' });
    const [levhaForm, setLevhaForm] = useState({ title: '', type: 'chat', icon: '' });
    const [roleForm, setRoleForm] = useState({ name: '', color: '#0066ff', position: 10, permissions: ['view', 'write'] });

    // Sağ Tık Bağlam Menüsü (Context Menu)
    const [contextMenu, setContextMenu] = useState({
        visible: false,
        x: 0,
        y: 0,
        type: null, // 'cadir' | 'masa' | 'levha'
        item: null,
        parent: null
    });

    // İsim Düzenleme (Rename) Formu
    const [renameForm, setRenameForm] = useState({ type: '', id: 0, name: '' });

    // Davet Sistemi State'leri
    const [inviteData, setInviteData] = useState(null);
    const [inviteCopied, setInviteCopied] = useState(false);
    const [inviteSearchQuery, setInviteSearchQuery] = useState('');
    const [inviteSearchResults, setInviteSearchResults] = useState([]);
    const [isSearchingUsers, setIsSearchingUsers] = useState(false);
    const [inviteSending, setInviteSending] = useState(false);
    const [inviteTab, setInviteTab] = useState('link'); // 'link' | 'user'

    // E-Oba Ekle veya Katıl State'leri
    const [addJoinStep, setAddJoinStep] = useState('choice'); // 'choice' | 'join'
    const [joinLinkInput, setJoinLinkInput] = useState('');
    const [joinLoading, setJoinLoading] = useState(false);

    useEffect(() => {
        const handleGlobalClick = () => {
            if (contextMenu.visible) {
                setContextMenu(prev => ({ ...prev, visible: false }));
            }
        };
        window.addEventListener('click', handleGlobalClick);
        return () => window.removeEventListener('click', handleGlobalClick);
    }, [contextMenu.visible]);

    // Bildirim Mesajı
    const [toast, setToast] = useState('');
    const showToast = (msg) => {
        setToast(msg);
        setTimeout(() => setToast(''), 3500);
    };

    // 1. Obaları Yükle
    const loadObalar = async () => {
        try {
            const url = currentUser ? `${API_URL}/api/eoba/obalar?user_id=${currentUser.id}` : `${API_URL}/api/eoba/obalar`;
            const res = await fetch(url);
            const data = await res.json();
            if (Array.isArray(data)) {
                setObalar(data);
                if (data.length > 0 && (!activeObaId || !data.some(o => o.id === activeObaId))) {
                    setActiveObaId(data[0].id);
                }
            }
        } catch (err) {
            console.error("Obalar yüklenemedi:", err);
        }
    };

    useEffect(() => {
        loadObalar();
    }, [currentUser?.id]);

    // 2. Seçili Obanın Ağacını ve Detayını Yükle
    const loadObaData = async (obaId) => {
        if (!obaId) return;
        try {
            const userParam = currentUser ? `?user_id=${currentUser.id}` : '';
            
            // Oba Detayı
            const resDetail = await fetch(`${API_URL}/api/eoba/obalar/${obaId}${userParam}`);
            if (resDetail.ok) {
                const detail = await resDetail.json();
                setObaDetail(detail);
                setObaSettingsForm({
                    name: detail.name || '',
                    description: detail.description || '',
                    avatar_url: detail.avatar_url || '',
                    is_public: detail.is_public ?? 1
                });
            }

            // Hiyerarşi Ağacı
            const resTree = await fetch(`${API_URL}/api/eoba/obalar/${obaId}/tree${userParam}`);
            if (resTree.ok) {
                const treeData = await resTree.json();
                const cadirlar = treeData.tree || [];
                setTree(cadirlar);

                // İlk masa ve ilk levhayı otomatik seç (mevcut seçim geçersizse)
                if (cadirlar.length > 0) {
                    const firstCadir = cadirlar[0];
                    if (firstCadir.masalar && firstCadir.masalar.length > 0) {
                        const firstMasa = firstCadir.masalar[0];
                        setActiveMasa(firstMasa);
                        if (firstMasa.levhalar && firstMasa.levhalar.length > 0) {
                            setActiveLevha(firstMasa.levhalar[0]);
                        } else {
                            setActiveLevha(null);
                        }
                    } else {
                        setActiveMasa(null);
                        setActiveLevha(null);
                    }
                } else {
                    setActiveMasa(null);
                    setActiveLevha(null);
                }
            }

            // Üyeleri Yükle
            const resMembers = await fetch(`${API_URL}/api/eoba/obalar/${obaId}/members`);
            if (resMembers.ok) {
                setMembers(await resMembers.json());
            }

            // Rolleri Yükle
            const resRoles = await fetch(`${API_URL}/api/eoba/obalar/${obaId}/roles`);
            if (resRoles.ok) {
                setRoles(await resRoles.json());
            }
        } catch (err) {
            console.error("Oba verileri yüklenemedi:", err);
        }
    };

    useEffect(() => {
        if (activeObaId) {
            loadObaData(activeObaId);
        }
    }, [activeObaId]);

    // Çadır Aç/Kapa
    const toggleCadir = (cadirId) => {
        setCollapsedCadirlar(prev => ({ ...prev, [cadirId]: !prev[cadirId] }));
    };

    // Masa Aç/Kapa
    const toggleMasa = (masaId) => {
        setCollapsedMasalar(prev => ({ ...prev, [masaId]: !prev[masaId] }));
    };

    // Levha Seçimi
    const handleSelectLevha = (masa, levha) => {
        setActiveMasa(masa);
        setActiveLevha(levha);
        if (isMobile) {
            setMobileTab('workspace');
        }
    };

    // Oba Oluşturma
    const handleCreateOba = async (e) => {
        e.preventDefault();
        if (!currentUser) return showToast("Oba oluşturmak için giriş yapmalısınız.");
        if (!obaForm.name.trim()) return;

        try {
            const res = await fetch(`${API_URL}/api/eoba/obalar`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: obaForm.name,
                    description: obaForm.description,
                    is_public: obaForm.is_public,
                    user_id: currentUser.id,
                    avatar_url: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(obaForm.name)}`
                })
            });
            const data = await res.json();
            if (res.ok) {
                showToast("Yeni E-Oba kuruldu.");
                setModalType(null);
                setObaForm({ name: '', description: '', is_public: 1 });
                await loadObalar();
                setActiveObaId(data.oba_id);
            } else {
                showToast(data.detail || "Oba oluşturulamadı.");
            }
        } catch (err) {
            showToast("Bağlantı hatası!");
        }
    };

    // Oba Ayarlarını Güncelleme
    const handleUpdateObaSettings = async (e) => {
        e.preventDefault();
        if (!activeObaId || !currentUser) return;
        try {
            const res = await fetch(`${API_URL}/api/eoba/obalar/${activeObaId}`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: obaSettingsForm.name,
                    description: obaSettingsForm.description,
                    avatar_url: obaSettingsForm.avatar_url,
                    is_public: obaSettingsForm.is_public,
                    user_id: currentUser.id
                })
            });
            if (res.ok) {
                showToast("Sunucu ayarları kaydedildi.");
                loadObaData(activeObaId);
                loadObalar();
                setModalType(null);
            } else {
                const d = await res.json();
                showToast(d.detail || "Ayarlar kaydedilemedi.");
            }
        } catch {
            showToast("Bağlantı hatası!");
        }
    };

    // Obayı Silme (Kalıcı)
    const handleDeleteOba = async () => {
        if (!window.confirm(`"${obaDetail?.name}" obasını kalıcı olarak silmek istediğinize emin misiniz? Bu işlem geri alınamaz!`)) return;
        try {
            const res = await fetch(`${API_URL}/api/eoba/obalar/${activeObaId}?user_id=${currentUser.id}`, { method: 'DELETE' , headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } });
            if (res.ok) {
                showToast("E-Oba kalıcı olarak silindi.");
                setModalType(null);
                setActiveObaId(null);
                await loadObalar();
            } else {
                const d = await res.json();
                showToast(d.detail || "Silinemedi.");
            }
        } catch {
            showToast("Hata oluştu.");
        }
    };

    // Çadır Ekleme
    const handleCreateCadir = async (e) => {
        e.preventDefault();
        if (!cadirForm.name.trim()) return;
        try {
            const res = await fetch(`${API_URL}/api/eoba/cadirlar`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    oba_id: activeObaId,
                    name: cadirForm.name,
                    user_id: currentUser.id
                })
            });
            if (res.ok) {
                showToast("Çadır açıldı.");
                setModalType(null);
                setCadirForm({ name: '' });
                loadObaData(activeObaId);
            }
        } catch {
            showToast("Hata oluştu.");
        }
    };

    // Çadır Silme
    const handleDeleteCadir = async (cadirId) => {
        if (!window.confirm("Bu çadırı ve altındaki tüm masa/levhaları silmek istediğinize emin misiniz?")) return;
        try {
            const res = await fetch(`${API_URL}/api/eoba/cadirlar/${cadirId}?user_id=${currentUser.id}`, { method: 'DELETE' , headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } });
            if (res.ok) {
                showToast("Çadır silindi.");
                loadObaData(activeObaId);
            }
        } catch {
            showToast("Silinemedi.");
        }
    };

    // Masa Ekleme
    const handleCreateMasa = async (e) => {
        e.preventDefault();
        if (!masaForm.name.trim() || !selectedTarget) return;
        try {
            const res = await fetch(`${API_URL}/api/eoba/masalar`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    cadir_id: selectedTarget.id,
                    name: masaForm.name,
                    icon: masaForm.icon,
                    user_id: currentUser.id
                })
            });
            if (res.ok) {
                showToast("Yeni masa açıldı.");
                setModalType(null);
                setMasaForm({ name: '', icon: '' });
                loadObaData(activeObaId);
            }
        } catch {
            showToast("Hata oluştu.");
        }
    };

    // Masa Silme
    const handleDeleteMasa = async (masaId) => {
        if (!window.confirm("Bu masayı ve tüm levhalarını silmek istediğinize emin misiniz?")) return;
        try {
            const res = await fetch(`${API_URL}/api/eoba/masalar/${masaId}?user_id=${currentUser.id}`, { method: 'DELETE' , headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } });
            if (res.ok) {
                showToast("Masa silindi.");
                loadObaData(activeObaId);
            }
        } catch {
            showToast("Silinemedi.");
        }
    };

    // Levha Ekleme
    const handleCreateLevha = async (e) => {
        e.preventDefault();
        if (!levhaForm.title.trim() || !selectedTarget) return;
        try {
            const res = await fetch(`${API_URL}/api/eoba/levhalar`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    masa_id: selectedTarget.id,
                    title: levhaForm.title,
                    type: levhaForm.type,
                    icon: levhaForm.icon,
                    user_id: currentUser.id
                })
            });
            if (res.ok) {
                showToast("Yeni levha hazırlandı.");
                setModalType(null);
                setLevhaForm({ title: '', type: 'chat', icon: '' });
                loadObaData(activeObaId);
            }
        } catch {
            showToast("Hata oluştu.");
        }
    };

    // Levha Silme
    const handleDeleteLevha = async (levhaId) => {
        if (!window.confirm("Bu levhayı silmek istediğinize emin misiniz?")) return;
        try {
            const res = await fetch(`${API_URL}/api/eoba/levhalar/${levhaId}?user_id=${currentUser.id}`, { method: 'DELETE' , headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } });
            if (res.ok) {
                showToast("Levha silindi.");
                loadObaData(activeObaId);
            }
        } catch {
            showToast("Silinemedi.");
        }
    };

    // Hedef İzinleri Modalını Aç
    const openPermissionsModal = async (type, id, name) => {
        setSelectedTarget({ type, id, name });
        try {
            const res = await fetch(`${API_URL}/api/eoba/permissions/${type}/${id}`);
            if (res.ok) {
                setTargetPerms(await res.json());
            }
            setModalType('permissions');
        } catch {
            showToast("İzinler yüklenemedi.");
        }
    };

    // Sağ Tık Menüsü Tetikleyici
    const handleContextMenu = (e, type, item, parent = null) => {
        e.preventDefault();
        e.stopPropagation();
        setContextMenu({
            visible: true,
            x: Math.min(e.clientX, window.innerWidth - 220),
            y: Math.min(e.clientY, window.innerHeight - 240),
            type,
            item,
            parent
        });
    };

    // Boş Alan Menü Tetikleyicisi (Sol Tık & Sağ Tık)
    const handleEmptySpaceTrigger = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setContextMenu({
            visible: true,
            x: Math.min(e.clientX, window.innerWidth - 220),
            y: Math.min(e.clientY, window.innerHeight - 260),
            type: 'empty_space',
            item: obaDetail,
            parent: null
        });
    };

    // İsim Değiştirme / Düzenleme Kaydet
    const handleRenameSubmit = async (e) => {
        e.preventDefault();
        if (!renameForm.name.trim() || !currentUser) return;
        try {
            let endpoint = '';
            if (renameForm.type === 'cadir') endpoint = `${API_URL}/api/eoba/cadirlar/${renameForm.id}`;
            else if (renameForm.type === 'masa') endpoint = `${API_URL}/api/eoba/masalar/${renameForm.id}`;
            else if (renameForm.type === 'levha') endpoint = `${API_URL}/api/eoba/levhalar/${renameForm.id}`;

            const res = await fetch(endpoint, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: renameForm.name, user_id: currentUser.id })
            });
            if (res.ok) {
                showToast("İsim başarıyla güncellendi.");
                setModalType(null);
                loadObaData(activeObaId);
                if (activeLevha && renameForm.type === 'levha' && activeLevha.id === renameForm.id) {
                    setActiveLevha(prev => ({ ...prev, title: renameForm.name }));
                }
            } else {
                const d = await res.json();
                showToast(d.detail || "Güncelleme başarısız.");
            }
        } catch {
            showToast("Bağlantı hatası.");
        }
    };


    // Hedef İzni Kaydet
    const handleSavePermissionOverride = async (roleId, allowPerms, denyPerms) => {
        if (!selectedTarget) return;
        try {
            const res = await fetch(`${API_URL}/api/eoba/permissions/${selectedTarget.type}/${selectedTarget.id}`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    target_type: selectedTarget.type,
                    target_id: selectedTarget.id,
                    role_id: roleId,
                    allow_perms: allowPerms,
                    deny_perms: denyPerms,
                    user_id: currentUser.id
                })
            });
            if (res.ok) {
                showToast("İzin kuralı güncellendi.");
                openPermissionsModal(selectedTarget.type, selectedTarget.id, selectedTarget.name);
            }
        } catch {
            showToast("Hata oluştu.");
        }
    };

    // Obaya Katıl / Ayrıl
    const handleJoinOba = async () => {
        if (!currentUser) return showToast("Önce giriş yapmalısınız.");
        try {
            const res = await fetch(`${API_URL}/api/eoba/obalar/${activeObaId}/join`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: currentUser.id })
            });
            if (res.ok) {
                showToast("Obaya hoş geldin!");
                loadObaData(activeObaId);
                loadObalar();
            }
        } catch {
            showToast("Katılma başarısız.");
        }
    };

    const handleLeaveOba = async () => {
        if (!window.confirm("Bu obadan ayrılmak istiyor musunuz?")) return;
        try {
            const res = await fetch(`${API_URL}/api/eoba/obalar/${activeObaId}/leave`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: currentUser.id })
            });
            if (res.ok) {
                showToast("Obadan ayrıldınız.");
                loadObaData(activeObaId);
                loadObalar();
            }
        } catch {
            showToast("İşlem başarısız.");
        }
    };

    // --- OBA DAVET SİSTEMİ FONKSİYONLARI ---

    const handleOpenInviteModal = async () => {
        if (!activeObaId || !currentUser) return;
        setModalType('invite_member');
        setInviteCopied(false);
        setInviteSearchQuery('');
        setInviteSearchResults([]);
        try {
            const res = await fetch(`${API_URL}/api/eoba/obalar/${activeObaId}/invites`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: currentUser.id, max_uses: null, expires_days: null })
            });
            if (res.ok) {
                const data = await res.json();
                setInviteData(data);
            }
        } catch (e) {
            console.error("Davet linki alınamadı:", e);
        }
    };

    const handleCopyInviteLink = () => {
        if (!inviteData?.code) return;
        const url = `${window.location.origin}/e-oba?davet=${inviteData.code}`;
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(url);
        } else {
            const textArea = document.createElement("textarea");
            textArea.value = url;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand("copy");
            document.body.removeChild(textArea);
        }
        setInviteCopied(true);
        setTimeout(() => setInviteCopied(false), 2500);
        showToast("Davet bağlantısı panoya kopyalandı!");
    };

    const handleSendDirectInvite = async (targetUsername) => {
        if (!targetUsername || !activeObaId || !currentUser) return;
        setInviteSending(true);
        try {
            const res = await fetch(`${API_URL}/api/eoba/obalar/${activeObaId}/invite-user`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sender_id: currentUser.id,
                    target_username: targetUsername
                })
            });
            const data = await res.json();
            if (res.ok) {
                showToast(data.message || "Davet başarıyla gönderildi.");
                setInviteSearchQuery('');
                setInviteSearchResults([]);
            } else {
                showToast(data.detail || "Davet gönderilemedi.");
            }
        } catch {
            showToast("Bağlantı hatası.");
        } finally {
            setInviteSending(false);
        }
    };

    const handleProcessInvite = async (code) => {
        if (!code) return;
        if (!currentUser) {
            showToast("Obaya katılmak için lütfen önce giriş yapın.");
            return;
        }
        try {
            const res = await fetch(`${API_URL}/api/eoba/invites/use`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    code: code,
                    user_id: currentUser.id
                })
            });
            const data = await res.json();
            if (res.ok) {
                window.history.replaceState({}, document.title, window.location.pathname);
                showToast(`"${data.name}" obasına başarıyla katıldınız!`);
                await loadObalar();
                setActiveObaId(data.oba_id);
            } else {
                showToast(data.detail || "Davet linki geçersiz veya süresi dolmuş.");
            }
        } catch {
            showToast("Davet bağlantısı işlenirken hata oluştu.");
        }
    };

    // URL'den gelen davet kodunu yakala ve işle
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const code = params.get('davet') || params.get('invite');
        if (code && currentUser) {
            handleProcessInvite(code);
        }
    }, [currentUser]);

    // Canlı Maker / Kullanıcı Arama
    useEffect(() => {
        if (!inviteSearchQuery.trim() || inviteSearchQuery.length < 2) {
            setInviteSearchResults([]);
            return;
        }
        const timer = setTimeout(async () => {
            setIsSearchingUsers(true);
            try {
                const res = await fetch(`${API_URL}/api/eoba/users/search?q=${encodeURIComponent(inviteSearchQuery)}&oba_id=${activeObaId}`);
                if (res.ok) {
                    const data = await res.json();
                    setInviteSearchResults(data);
                }
            } catch (err) {
                console.error("Arama hatası:", err);
            } finally {
                setIsSearchingUsers(false);
            }
        }, 300);
        return () => clearTimeout(timer);
    }, [inviteSearchQuery, activeObaId]);

    const handleJoinWithLink = async (e) => {
        e.preventDefault();
        let raw = joinLinkInput.trim();
        if (!raw) return;
        let code = raw;
        if (raw.includes('davet=')) {
            code = raw.split('davet=')[1].split('&')[0];
        } else if (raw.includes('invite=')) {
            code = raw.split('invite=')[1].split('&')[0];
        } else if (raw.includes('/')) {
            code = raw.split('/').pop();
        }
        code = code.trim();
        if (!code) {
            showToast("Lütfen geçerli bir davet kodu veya linki girin.");
            return;
        }
        await handleProcessInvite(code);
        setModalType(null);
    };

    const canManageStructure = obaDetail?.permissions?.manage_structure || obaDetail?.permissions?.admin;
    const canManageRoles = obaDetail?.permissions?.manage_roles || obaDetail?.permissions?.admin;
    const isObaAdmin = obaDetail?.permissions?.admin || obaDetail?.is_owner;

    return (
        <div style={{ ...styles.container, flexDirection: isMobile ? 'column' : 'row' }}>
            {/* TOAST BİLDİRİMİ */}
            {toast && <div style={styles.toast}>{toast}</div>}

            {/* MOBİL GÖRÜNÜM SEÇİCİ SEKMELER (Sadece ekranda < 768px iken görünür) */}
            {isMobile && (
                <div style={styles.mobileNavTabBar}>
                    <button
                        onClick={() => setMobileTab('channels')}
                        style={{
                            ...styles.mobileNavTabBtn,
                            borderBottom: mobileTab === 'channels' ? `2px solid ${PRIMARY_BLUE}` : '2px solid transparent',
                            color: mobileTab === 'channels' ? '#fff' : '#888'
                        }}
                    >
                        Masalar
                    </button>
                    <button
                        onClick={() => setMobileTab('workspace')}
                        style={{
                            ...styles.mobileNavTabBtn,
                            borderBottom: mobileTab === 'workspace' ? `2px solid ${PRIMARY_BLUE}` : '2px solid transparent',
                            color: mobileTab === 'workspace' ? '#fff' : '#888'
                        }}
                    >
                        {activeLevha ? activeLevha.title : 'Levha'}
                    </button>
                    <button
                        onClick={() => setMobileTab('members')}
                        style={{
                            ...styles.mobileNavTabBtn,
                            borderBottom: mobileTab === 'members' ? `2px solid ${PRIMARY_BLUE}` : '2px solid transparent',
                            color: mobileTab === 'members' ? '#fff' : '#888'
                        }}
                    >
                        Üyeler: {members.length}
                    </button>
                </div>
            )}

            {/* SÜTUN 1 & 2 MOBİL SARICI VEYA DİREKT ELEMANLAR */}
            {(!isMobile || mobileTab === 'channels') && (
                <>
                    {/* SÜTUN 1: OBA SEÇİCİ */}
                    <div style={{ ...styles.obaSidebar, height: isMobile ? 'calc(100vh - 125px)' : '100%' }}>
                        <div style={styles.obaList}>
                            {obalar.map((oba) => {
                                const isActive = oba.id === activeObaId;
                                return (
                                    <div key={oba.id} style={styles.obaIconWrapper}>
                                        {isActive && <div style={styles.activePill} />}
                                        <button
                                            onClick={() => setActiveObaId(oba.id)}
                                            title={oba.name}
                                            style={{
                                                ...styles.obaIconButton,
                                                backgroundColor: isActive ? PRIMARY_BLUE : '#1e1e28',
                                                borderRadius: isActive ? '16px' : '50%'
                                            }}
                                        >
                                            {oba.avatar_url ? (
                                                <img src={oba.avatar_url} alt={oba.name} style={styles.obaAvatarImg} />
                                            ) : (
                                                <span style={styles.obaInitial}>{oba.name.charAt(0).toUpperCase()}</span>
                                            )}
                                        </button>
                                    </div>
                                );
                            })}

                            {/* Yeni Oba Açma / Katılma Butonu */}
                            <div style={styles.obaIconWrapper}>
                                <button
                                    onClick={() => {
                                        setAddJoinStep('choice');
                                        setJoinLinkInput('');
                                        setModalType('add_or_join_oba');
                                    }}
                                    title="E-Oba Ekle veya Katıl"
                                    style={styles.addObaButton}
                                >
                                    +
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* SÜTUN 2: ÇADIRLAR, MASALAR VE LEVHALAR AĞACI */}
                    <div style={{
                        ...styles.channelSidebar,
                        width: isMobile ? 'calc(100% - 72px)' : '270px',
                        height: isMobile ? 'calc(100vh - 125px)' : '100%'
                    }}>
                        {obaDetail ? (
                            <>

                        {/* Oba Başlık & Menü */}
                        <div style={styles.obaHeader}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                                {obaDetail.avatar_url && (
                                    <img src={obaDetail.avatar_url} alt="" style={styles.miniHeaderAvatar} />
                                )}
                                <span style={styles.obaTitle}>{obaDetail.name}</span>
                            </div>
                            <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                                {isObaAdmin && (
                                    <button
                                        onClick={() => {
                                            setSettingsTab('general');
                                            setModalType('oba_settings');
                                        }}
                                        style={styles.headerIconButton}
                                        title="Sunucu (E-Oba) Ayarları"
                                    >
                                        ⚙️
                                    </button>
                                )}
                                {obaDetail.is_member ? (
                                    !obaDetail.is_owner && (
                                        <button onClick={handleLeaveOba} style={styles.leaveObaBtn} title="Obadan Ayrıl">
                                            🚪
                                        </button>
                                    )
                                ) : (
                                    <button onClick={handleJoinOba} style={styles.joinObaBtn}>
                                        Katıl
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Çadırlar -> Masalar -> Levhalar Ağacı */}
                        <div
                            style={{
                                ...styles.treeScrollArea,
                                display: 'flex',
                                flexDirection: 'column'
                            }}
                            onContextMenu={(e) => {
                                if (e.target === e.currentTarget) {
                                    handleEmptySpaceTrigger(e);
                                }
                            }}
                        >
                            {tree.length === 0 ? (
                                <div
                                    onContextMenu={handleEmptySpaceTrigger}
                                    style={{
                                        ...styles.emptyNotice,
                                        padding: '30px 12px',
                                        textAlign: 'center'
                                    }}
                                    title="Seçenekler için sağ tıklayın"
                                >
                                    Bu obada henüz çadır kurulmamış.
                                    {(canManageStructure || isObaAdmin) && (
                                        <div style={{ marginTop: '6px', fontSize: '11px', color: '#60a5fa' }}>
                                            Seçenekler için sağ tıklayın.
                                        </div>
                                    )}
                                </div>
                            ) : (
                                tree.map((cadir) => {
                                    const isCadirCollapsed = collapsedCadirlar[cadir.id];
                                    return (
                                        <div key={cadir.id} style={styles.cadirContainer}>
                                            {/* Çadır Başlığı (Accordion) */}
                                            <div
                                                style={styles.cadirHeader}
                                                className="eoba-tree-cadir"
                                                onContextMenu={(e) => handleContextMenu(e, 'cadir', cadir)}
                                            >
                                                <div
                                                    onClick={() => toggleCadir(cadir.id)}
                                                    style={styles.cadirTitleArea}
                                                >
                                                    <span style={styles.cadirArrow} className="eoba-cadir-arrow">{isCadirCollapsed ? '▶' : '▼'}</span>
                                                    <span style={styles.cadirName} className="eoba-cadir-name">{cadir.name}</span>
                                                </div>
                                            </div>

                                            {/* Çadır Altındaki Masalar */}
                                            {!isCadirCollapsed && cadir.masalar && (
                                                <div style={styles.masaList}>
                                                    {cadir.masalar.map((masa) => {
                                                        const isMasaCollapsed = collapsedMasalar[masa.id];
                                                        const isThisMasaActive = activeMasa?.id === masa.id;
                                                        return (
                                                            <div key={masa.id} style={styles.masaBlock}>
                                                                {/* Masa Başlık Satırı */}
                                                                <div
                                                                    onClick={() => toggleMasa(masa.id)}
                                                                    onContextMenu={(e) => handleContextMenu(e, 'masa', masa, cadir)}
                                                                    style={{
                                                                        ...styles.masaRowHeader,
                                                                        color: isThisMasaActive ? '#fff' : '#94a3b8'
                                                                    }}
                                                                    className={`eoba-tree-masa ${isThisMasaActive ? 'active' : ''}`}
                                                                >
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1, overflow: 'hidden' }}>
                                                                        <span style={styles.masaArrow} className="eoba-masa-arrow">{isMasaCollapsed ? '▶' : '▼'}</span>
                                                                        <span style={styles.masaNameText} className="eoba-masa-name">{masa.name}</span>
                                                                    </div>
                                                                </div>

                                                                {/* Masanın Altındaki Levhalar */}
                                                                {!isMasaCollapsed && (
                                                                    <div style={styles.levhaNestedList}>
                                                                        {masa.levhalar && masa.levhalar.length > 0 ? (
                                                                            masa.levhalar.map((levha) => {
                                                                                const isLevhaActive = activeLevha?.id === levha.id;
                                                                                return (
                                                                                    <div
                                                                                        key={levha.id}
                                                                                        onClick={() => handleSelectLevha(masa, levha)}
                                                                                        onContextMenu={(e) => handleContextMenu(e, 'levha', levha, masa)}
                                                                                        style={{
                                                                                            ...styles.levhaSidebarItem,
                                                                                            backgroundColor: isLevhaActive ? 'rgba(0, 102, 255, 0.22)' : 'transparent',
                                                                                            borderLeft: isLevhaActive ? `3px solid ${PRIMARY_BLUE}` : '3px solid transparent',
                                                                                            color: isLevhaActive ? '#fff' : '#94a3b8'
                                                                                        }}
                                                                                        className={`eoba-tree-levha ${isLevhaActive ? 'active' : ''}`}
                                                                                    >
                                                                                        <span style={styles.levhaItemTitle} className="eoba-levha-name">{levha.title}</span>
                                                                                    </div>
                                                                                );
                                                                            })
                                                                        ) : (
                                                                            canManageStructure && (
                                                                                <button
                                                                                    onClick={() => {
                                                                                        setSelectedTarget({ type: 'masa', id: masa.id, name: masa.name });
                                                                                        setModalType('create_levha');
                                                                                    }}
                                                                                    style={styles.miniAddLevhaBtn}
                                                                                >
                                                                                    + Levha Ekle
                                                                                </button>
                                                                            )
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })
                            )}

                            {/* Ağaç Altındaki Boş Alan (Sağ Tıklayınca Menü Açar: Yeni Çadır Oluştur, Sunucu Düzenle) */}
                            {(canManageStructure || isObaAdmin) && (
                                <div
                                    onContextMenu={handleEmptySpaceTrigger}
                                    style={{
                                        flex: 1,
                                        minHeight: '120px'
                                    }}
                                    title="Seçenekler için sağ tıklayın"
                                />
                            )}
                        </div>
                    </>
                ) : (
                    <div style={styles.emptyNotice}>Oba seçiniz...</div>
                )}
                    </div>
                </>
            )}

            {/* SÜTUN 3: MERKEZ ÇALIŞMA ALANI */}
            {(!isMobile || mobileTab === 'workspace') && (
                <div style={{
                    ...styles.mainWorkspace,
                    width: isMobile ? '100%' : 'auto',
                    height: isMobile ? 'calc(100vh - 125px)' : '100%'
                }}>
                    {activeLevha ? (
                        <>
                            {/* Üst Başlık & Yol Haritası (Breadcrumb) */}
                            <div style={styles.levhaHeaderBar}>
                                <div style={styles.levhaHeaderLeft}>
                                    {isMobile && (
                                        <button
                                            onClick={() => setMobileTab('channels')}
                                            style={styles.mobileBackBtn}
                                            title="Masalara Dön"
                                        >
                                            ◀ Masalar
                                        </button>
                                    )}
                                    <span style={{ fontSize: '13px', color: '#71717a' }}>{activeMasa?.name}</span>
                                    <span style={{ color: '#444' }}>/</span>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <h2 style={styles.levhaActiveTitleText}>{activeLevha.title}</h2>
                                    </div>

                                    <span style={styles.levhaTypeBadge}>
                                        {activeLevha.type === 'chat' && 'Sohbet Levhası'}
                                        {activeLevha.type === 'duyuru' && 'Duyuru Levhası'}
                                        {activeLevha.type === 'tablo' && 'Tablo Levhası (BOM)'}
                                        {activeLevha.type === 'kanban' && 'Görev Panosu'}
                                    </span>
                                </div>
                            </div>

                            {/* Aktif Levhanın İçerik Motoru */}
                            <div style={styles.levhaContentArea}>
                                {activeLevha.type === 'chat' && (
                                    <ChatLevhasi levha={activeLevha} user={currentUser} showToast={showToast} />
                                )}
                                {activeLevha.type === 'duyuru' && (
                                    <DuyuruLevhasi levha={activeLevha} user={currentUser} showToast={showToast} />
                                )}
                                {activeLevha.type === 'tablo' && (
                                    <TabloLevhasi levha={activeLevha} user={currentUser} showToast={showToast} />
                                )}
                                {activeLevha.type === 'kanban' && (
                                    <KanbanLevhasi levha={activeLevha} user={currentUser} members={members} showToast={showToast} />
                                )}
                            </div>
                        </>
                    ) : (
                        <div style={styles.emptyCenterNotice}>
                            <h3 style={{ margin: '0 0 10px 0', fontSize: '18px', color: '#fff' }}>
                                {t('eoba_welcome_workspace')}
                            </h3>
                            <p style={{ margin: 0, fontSize: '13px', color: '#888', maxWidth: '420px', lineHeight: '1.5' }}>
                                {t('eoba_welcome_workspace_desc')}
                            </p>
                        </div>
                    )}
                </div>
            )}

            {/* SÜTUN 4: ÜYELER PANELİ (Discord Tarzı Sağ Kenar) */}
            {((!isMobile && showMemberSidebar) || (isMobile && mobileTab === 'members')) && (
                <div style={{
                    ...styles.memberSidebar,
                    width: isMobile ? '100%' : '220px',
                    height: isMobile ? 'calc(100vh - 125px)' : '100%'
                }}>
                    <div style={{ ...styles.memberSidebarHeader, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>{t('eoba_oba_members')}: {members.length}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                            {obaDetail?.is_member && (
                                <button
                                    onClick={handleOpenInviteModal}
                                    style={styles.miniInviteBtn}
                                    title={t('eoba_invite_member')}
                                >
                                    + {t('eoba_invite_btn')}
                                </button>
                            )}
                            {!isMobile && (
                                <button
                                    onClick={() => setShowMemberSidebar(false)}
                                    style={styles.collapseMemberBtn}
                                    className="eoba-collapse-btn"
                                    title="—"
                                >
                                    ▶
                                </button>
                            )}
                        </div>
                    </div>

                    <div style={styles.memberListScroll}>
                        {members.map((member) => (
                            <div
                                key={member.user_id}
                                onClick={() => {
                                    setSelectedMember(member);
                                    setModalType('member_action');
                                }}
                                style={{
                                    ...styles.memberRow,
                                    cursor: 'pointer'
                                }}
                                title={member.display_name}
                            >
                                {member.profile_image ? (
                                    <img src={member.profile_image} alt="PP" style={styles.memberAvatar} />
                                ) : (
                                    <div style={styles.memberAvatarPlaceholder}>👤</div>
                                )}

                                <div style={{ overflow: 'hidden' }}>
                                    <div style={{
                                        ...styles.memberName,
                                        color: member.roles?.[0]?.color || '#fff'
                                    }}>
                                        {member.display_name}
                                    </div>
                                    <div style={styles.memberRoleTags}>
                                        {member.roles && member.roles.length > 0 ? (
                                            member.roles.map(r => (
                                                <span key={r.id} style={{ ...styles.roleMiniTag, borderColor: r.color, color: r.color }}>
                                                    {r.name}
                                                </span>
                                            ))
                                        ) : (
                                            <span style={styles.defaultRoleTag}>{t('eoba_members')}</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* SAĞA KÜÇÜLTÜLMÜŞ ÜYE ŞERİDİ (Tıklayınca tekrar genişler) */}
            {!showMemberSidebar && !isMobile && (
                <div
                    onClick={() => setShowMemberSidebar(true)}
                    style={styles.collapsedMemberBar}
                    className="eoba-collapsed-member-bar"
                    title={t('eoba_members')}
                >
                    <span style={styles.collapsedExpandArrow}>◀</span>
                    <span style={styles.collapsedVerticalText}>{t('eoba_members')}: {members.length}</span>
                </div>
            )}

            {/* ----------------- MODALLAR ----------------- */}

            {/* 0. ÜYE ETKİLEŞİM & DM MODALI */}
            {modalType === 'member_action' && selectedMember && (
                <ModalWrapper title={`${selectedMember.display_name}`} onClose={() => setModalType(null)}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '20px' }}>
                        {selectedMember.profile_image ? (
                            <img src={selectedMember.profile_image} alt="" style={{ width: '52px', height: '52px', borderRadius: '50%', objectFit: 'cover' }} />
                        ) : (
                            <div style={{ width: '52px', height: '52px', borderRadius: '50%', backgroundColor: '#202030', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px' }}>👤</div>
                        )}
                        <div>
                            <h4 style={{ margin: '0 0 4px 0', color: '#fff', fontSize: '16px' }}>{selectedMember.display_name}</h4>
                            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                {selectedMember.roles && selectedMember.roles.length > 0 ? (
                                    selectedMember.roles.map(r => (
                                        <span key={r.id} style={{ ...styles.roleMiniTag, borderColor: r.color, color: r.color }}>{r.name}</span>
                                    ))
                                ) : (
                                    <span style={styles.defaultRoleTag}>Üye</span>
                                )}
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {currentUser && currentUser.id !== selectedMember.user_id && (
                            <button
                                onClick={() => {
                                    setModalType(null);
                                    window.dispatchEvent(new CustomEvent('open-dm-chat', {
                                        detail: { partner: { id: selectedMember.user_id, display_name: selectedMember.display_name, profile_image: selectedMember.profile_image } }
                                    }));
                                }}
                                style={styles.primaryActionButton}
                            >
                                Özel Mesaj Gönder (DM)
                            </button>
                        )}

                        {canManageRoles && (
                            <button
                                onClick={() => setModalType('assign_role')}
                                style={styles.secondaryBtn}
                            >
                                Rolleri ve Tag'leri Yönet
                            </button>
                        )}
                    </div>
                </ModalWrapper>
            )}

            {/* SAĞ TIK BAĞLAM MENÜSÜ (CONTEXT MENU) */}
            {contextMenu.visible && contextMenu.item && (
                <div
                    style={{
                        ...styles.contextMenuContainer,
                        top: `${contextMenu.y}px`,
                        left: `${contextMenu.x}px`
                    }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <div style={styles.contextMenuHeader}>
                        {contextMenu.type === 'cadir' && `Çadır: ${contextMenu.item?.name}`}
                        {contextMenu.type === 'masa' && `Masa: ${contextMenu.item?.name}`}
                        {contextMenu.type === 'levha' && `Levha: ${contextMenu.item?.title}`}
                        {contextMenu.type === 'empty_space' && `${obaDetail?.name || 'Oba İşlemleri'}`}
                    </div>

                    {/* Boş Alana Tıklayınca Açılan Seçenekler */}
                    {contextMenu.type === 'empty_space' && (
                        <>
                            {canManageStructure && (
                                <button
                                    style={styles.contextMenuItem}
                                    onClick={() => {
                                        setModalType('create_cadir');
                                        setContextMenu(prev => ({ ...prev, visible: false }));
                                    }}
                                >
                                    <span>{t('eoba_create_tent')}</span>
                                </button>
                            )}

                            {isObaAdmin && (
                                <button
                                    style={styles.contextMenuItem}
                                    onClick={() => {
                                        setSettingsTab('general');
                                        setModalType('oba_settings');
                                        setContextMenu(prev => ({ ...prev, visible: false }));
                                    }}
                                >
                                    <span>{t('eoba_edit_server')}</span>
                                </button>
                            )}

                            {isObaAdmin && (
                                <button
                                    style={styles.contextMenuItem}
                                    onClick={() => {
                                        setSettingsTab('roles');
                                        setModalType('oba_settings');
                                        setContextMenu(prev => ({ ...prev, visible: false }));
                                    }}
                                >
                                    <span>{t('eoba_roles_permissions')}</span>
                                </button>
                            )}

                            {obaDetail?.is_member && (
                                <button
                                    style={styles.contextMenuItem}
                                    onClick={() => {
                                        handleOpenInviteModal();
                                        setContextMenu(prev => ({ ...prev, visible: false }));
                                    }}
                                >
                                    <span>{t('eoba_invite_member')}</span>
                                </button>
                            )}
                        </>
                    )}

                    {canManageStructure && contextMenu.type !== 'empty_space' && (
                        <button
                            style={styles.contextMenuItem}
                            onClick={() => {
                                setRenameForm({
                                    type: contextMenu.type,
                                    id: contextMenu.item.id,
                                    name: contextMenu.type === 'levha' ? contextMenu.item.title : contextMenu.item.name
                                });
                                setModalType('rename_item');
                                setContextMenu(prev => ({ ...prev, visible: false }));
                            }}
                        >
                            <span>{contextMenu.type === 'cadir' ? 'Çadırı Düzenle' : contextMenu.type === 'masa' ? 'Masayı Düzenle' : 'Levhayı Düzenle'}</span>
                        </button>
                    )}

                    {canManageStructure && contextMenu.type === 'cadir' && (
                        <button
                            style={styles.contextMenuItem}
                            onClick={() => {
                                setSelectedTarget({ type: 'cadir', id: contextMenu.item.id, name: contextMenu.item.name });
                                setModalType('create_masa');
                                setContextMenu(prev => ({ ...prev, visible: false }));
                            }}
                        >
                            <span>Yeni Masa Ekle</span>
                        </button>
                    )}

                    {canManageStructure && contextMenu.type === 'masa' && (
                        <button
                            style={styles.contextMenuItem}
                            onClick={() => {
                                setSelectedTarget({ type: 'masa', id: contextMenu.item.id, name: contextMenu.item.name });
                                setModalType('create_levha');
                                setContextMenu(prev => ({ ...prev, visible: false }));
                            }}
                        >
                            <span>Yeni Levha Ekle</span>
                        </button>
                    )}

                    {canManageStructure && contextMenu.type !== 'empty_space' && (
                        <button
                            style={styles.contextMenuItem}
                            onClick={() => {
                                const name = contextMenu.type === 'levha' ? contextMenu.item.title : contextMenu.item.name;
                                openPermissionsModal(contextMenu.type, contextMenu.item.id, name);
                                setContextMenu(prev => ({ ...prev, visible: false }));
                            }}
                        >
                            <span>Yetkileri Düzenle</span>
                        </button>
                    )}

                    {canManageStructure && contextMenu.type !== 'empty_space' && (
                        <>
                            <div style={styles.contextMenuDivider} />
                            <button
                                style={{ ...styles.contextMenuItem, color: '#ef4444' }}
                                onClick={() => {
                                    const id = contextMenu.item.id;
                                    const type = contextMenu.type;
                                    setContextMenu(prev => ({ ...prev, visible: false }));
                                    if (type === 'cadir') handleDeleteCadir(id);
                                    else if (type === 'masa') handleDeleteMasa(id);
                                    else if (type === 'levha') handleDeleteLevha(id);
                                }}
                            >
                                <span>{contextMenu.type === 'cadir' ? 'Çadırı Sil' : contextMenu.type === 'masa' ? 'Masayı Sil' : 'Levhayı Sil'}</span>
                            </button>
                        </>
                    )}
                </div>
            )}

            {/* ÜYE DAVET ETME MODALI (Link & Doğrudan Kullanıcıya Gönderim) */}
            {modalType === 'invite_member' && (
                <ModalWrapper title={`Üye Davet Et — ${obaDetail?.name}`} onClose={() => setModalType(null)} width="520px">
                    {/* Sekmeler */}
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', borderBottom: '1px solid #222', paddingBottom: '10px' }}>
                        <button
                            type="button"
                            onClick={() => setInviteTab('link')}
                            style={{
                                flex: 1,
                                padding: '8px 12px',
                                borderRadius: '6px',
                                border: 'none',
                                backgroundColor: inviteTab === 'link' ? 'rgba(0, 102, 255, 0.15)' : '#161622',
                                color: inviteTab === 'link' ? '#fff' : '#888',
                                fontWeight: inviteTab === 'link' ? 'bold' : 'normal',
                                cursor: 'pointer',
                                fontSize: '12.5px'
                            }}
                        >
                            Davet Linki
                        </button>
                        <button
                            type="button"
                            onClick={() => setInviteTab('user')}
                            style={{
                                flex: 1,
                                padding: '8px 12px',
                                borderRadius: '6px',
                                border: 'none',
                                backgroundColor: inviteTab === 'user' ? 'rgba(0, 102, 255, 0.15)' : '#161622',
                                color: inviteTab === 'user' ? '#fff' : '#888',
                                fontWeight: inviteTab === 'user' ? 'bold' : 'normal',
                                cursor: 'pointer',
                                fontSize: '12.5px'
                            }}
                        >
                            Maker Ara ve Davet Gönder
                        </button>
                    </div>

                    {inviteTab === 'link' ? (
                        <div>
                            <p style={{ color: '#aaa', fontSize: '13px', marginBottom: '12px', lineHeight: '1.5' }}>
                                Aşağıdaki benzersiz bağlantıyı kopyalayarak WhatsApp, Discord veya forumlarda paylaşabilirsiniz. Bağlantıya tıklayanlar tek tıkla bu obaya katılır.
                            </p>

                            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                                <input
                                    type="text"
                                    readOnly
                                    value={inviteData?.code ? `${window.location.origin}/e-oba?davet=${inviteData.code}` : 'Bağlantı hazırlanıyor...'}
                                    style={{
                                        ...styles.formInput,
                                        flex: 1,
                                        backgroundColor: '#0c0c14',
                                        border: '1px solid #2f2f45',
                                        color: '#38bdf8',
                                        fontFamily: 'monospace',
                                        fontSize: '12px',
                                        padding: '10px'
                                    }}
                                />
                                <button
                                    type="button"
                                    onClick={handleCopyInviteLink}
                                    disabled={!inviteData?.code}
                                    style={{
                                        backgroundColor: inviteCopied ? '#10b981' : PRIMARY_BLUE,
                                        color: '#fff',
                                        border: 'none',
                                        borderRadius: '6px',
                                        padding: '0 16px',
                                        fontWeight: 'bold',
                                        fontSize: '13px',
                                        cursor: 'pointer',
                                        transition: '0.2s',
                                        minWidth: '100px'
                                    }}
                                >
                                    {inviteCopied ? 'Kopyalandı' : 'Kopyala'}
                                </button>
                            </div>

                            <div style={{
                                backgroundColor: '#12121c',
                                borderRadius: '8px',
                                padding: '12px',
                                fontSize: '12px',
                                color: '#888',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '8px',
                                border: '1px solid #1f1f2e'
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span>Link Geçerlilik Süresi:</span>
                                    <span style={{ color: '#fff', fontWeight: 'bold' }}>
                                        {inviteData?.expires_at ? inviteData.expires_at : 'Süresiz'}
                                    </span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span>Katılan Kişi Sayısı:</span>
                                    <span style={{ color: '#fff', fontWeight: 'bold' }}>
                                        {inviteData?.uses_count || 0} {inviteData?.max_uses ? `/ ${inviteData.max_uses}` : 'kişi (Sınırsız)'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div>
                            <p style={{ color: '#aaa', fontSize: '13px', marginBottom: '12px', lineHeight: '1.5' }}>
                                Platformdaki bir Maker'ı ismi veya e-postasıyla arayın. Davet gönderildiğinde hem zil bildirimi hem de özel mesaj (DM) iletilir.
                            </p>

                            <div style={{ position: 'relative', marginBottom: '14px' }}>
                                <input
                                    type="text"
                                    placeholder="Kullanıcı adı veya e-posta ile arayın..."
                                    value={inviteSearchQuery}
                                    onChange={(e) => setInviteSearchQuery(e.target.value)}
                                    style={styles.formInput}
                                    autoFocus
                                />
                                {isSearchingUsers && (
                                    <div style={{ position: 'absolute', right: '12px', top: '10px', fontSize: '11px', color: '#666' }}>
                                        Aranıyor...
                                    </div>
                                )}
                            </div>

                            {/* Arama Sonuçları Listesi */}
                            <div style={{
                                maxHeight: '220px',
                                overflowY: 'auto',
                                backgroundColor: '#0c0c14',
                                border: '1px solid #1a1a28',
                                borderRadius: '6px',
                                padding: '6px'
                            }}>
                                {inviteSearchResults.length > 0 ? (
                                    inviteSearchResults.map((u) => (
                                        <div
                                            key={u.id}
                                            style={{
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center',
                                                padding: '8px 10px',
                                                borderRadius: '4px',
                                                borderBottom: '1px solid #161622',
                                                backgroundColor: '#12121a'
                                            }}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                {u.profile_image ? (
                                                    <img src={u.profile_image} alt="" style={{ width: '28px', height: '28px', borderRadius: '50%' }} />
                                                ) : (
                                                    <div style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: '#222', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', color: '#fff' }}>
                                                        {u.display_name?.charAt(0)?.toUpperCase()}
                                                    </div>
                                                )}
                                                <div>
                                                    <div style={{ color: '#fff', fontSize: '13px', fontWeight: '600' }}>{u.display_name}</div>
                                                    <div style={{ color: '#666', fontSize: '11px' }}>{u.email}</div>
                                                </div>
                                            </div>

                                            {u.is_member ? (
                                                <span style={{ fontSize: '11px', color: '#666', padding: '3px 8px', backgroundColor: '#181824', borderRadius: '4px' }}>
                                                    Zaten Üye
                                                </span>
                                            ) : (
                                                <button
                                                    type="button"
                                                    disabled={inviteSending}
                                                    onClick={() => handleSendDirectInvite(u.display_name)}
                                                    style={{
                                                        backgroundColor: PRIMARY_BLUE,
                                                        color: '#fff',
                                                        border: 'none',
                                                        padding: '5px 12px',
                                                        borderRadius: '4px',
                                                        fontSize: '12px',
                                                        fontWeight: 'bold',
                                                        cursor: 'pointer'
                                                    }}
                                                >
                                                    {inviteSending ? 'Gönderiliyor...' : 'Davet Et'}
                                                </button>
                                            )}
                                        </div>
                                    ))
                                ) : inviteSearchQuery.length >= 2 ? (
                                    <div style={{ textAlign: 'center', padding: '16px', color: '#666', fontSize: '12px' }}>
                                        {isSearchingUsers ? 'Kullanıcılar aranıyor...' : 'Eşleşen kullanıcı bulunamadı.'}
                                    </div>
                                ) : (
                                    <div style={{ textAlign: 'center', padding: '16px', color: '#555', fontSize: '12px' }}>
                                        Aramak için en az 2 harf girin.
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    <div style={{ ...styles.modalFooter, marginTop: '20px' }}>
                        <button type="button" onClick={() => setModalType(null)} style={styles.cancelBtn}>Kapat</button>
                    </div>
                </ModalWrapper>
            )}

            {/* YENİDEN ADLANDIRMA / DÜZENLEME MODALI */}
            {modalType === 'rename_item' && (
                <ModalWrapper
                    title={renameForm.type === 'cadir' ? 'Çadırı Düzenle' : renameForm.type === 'masa' ? 'Masayı Düzenle' : 'Levhayı Düzenle'}
                    onClose={() => setModalType(null)}
                >
                    <form onSubmit={handleRenameSubmit}>
                        <div style={styles.formGroup}>
                            <label style={styles.formLabel}>Yeni İsim / Başlık</label>
                            <input
                                type="text"
                                style={styles.formInput}
                                value={renameForm.name}
                                onChange={(e) => setRenameForm({ ...renameForm, name: e.target.value })}
                                required
                                autoFocus
                            />
                        </div>
                        <div style={styles.modalFooter}>
                            <button type="button" onClick={() => setModalType(null)} style={styles.cancelBtn}>İptal</button>
                            <button type="submit" style={styles.primaryActionButton}>Kaydet</button>
                        </div>
                    </form>
                </ModalWrapper>
            )}

            {/* OBA EKLE VEYA KATIL SEÇİM MODALI */}
            {modalType === 'add_or_join_oba' && (
                <ModalWrapper
                    title={addJoinStep === 'choice' ? t('eoba_add_or_join_title') : t('eoba_join_with_link_title')}
                    onClose={() => setModalType(null)}
                    width="480px"
                >
                    {addJoinStep === 'choice' ? (
                        <div>
                            <p style={{ color: '#aaa', fontSize: '13px', marginBottom: '18px', lineHeight: '1.5', textAlign: 'center' }}>
                                {t('eoba_add_join_subtitle')}
                            </p>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {/* Seçenek 1: Yeni Oba Kur */}
                                <div
                                    onClick={() => setModalType('create_oba')}
                                    style={styles.addJoinChoiceCard}
                                    className="eoba-choice-card"
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                                        <div style={styles.choiceCardBadge}>
                                            {t('eoba_badge_create')}
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <div style={styles.choiceCardTitle}>{t('eoba_create_own_oba')}</div>
                                            <div style={styles.choiceCardDesc}>
                                                {t('eoba_create_own_oba_desc')}
                                            </div>
                                        </div>
                                        <span style={styles.choiceCardArrow} className="choice-arrow">→</span>
                                    </div>
                                </div>

                                {/* Seçenek 2: Bağlantı ile Katıl */}
                                <div
                                    onClick={() => setAddJoinStep('join')}
                                    style={styles.addJoinChoiceCard}
                                    className="eoba-choice-card"
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                                        <div style={{ ...styles.choiceCardBadge, backgroundColor: 'rgba(0, 102, 255, 0.18)', color: '#38bdf8' }}>
                                            {t('eoba_badge_join')}
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <div style={styles.choiceCardTitle}>{t('eoba_join_with_link')}</div>
                                            <div style={styles.choiceCardDesc}>
                                                {t('eoba_join_with_link_desc')}
                                            </div>
                                        </div>
                                        <span style={styles.choiceCardArrow} className="choice-arrow">→</span>
                                    </div>
                                </div>
                            </div>

                            <div style={{ ...styles.modalFooter, marginTop: '20px' }}>
                                <button type="button" onClick={() => setModalType(null)} style={styles.cancelBtn}>{t('btn_cancel')}</button>
                            </div>
                        </div>
                    ) : (
                        <form onSubmit={handleJoinWithLink}>
                            <p style={{ color: '#aaa', fontSize: '13px', marginBottom: '14px', lineHeight: '1.5' }}>
                                {t('eoba_paste_link_hint')}
                            </p>

                            <div style={styles.formGroup}>
                                <label style={styles.formLabel}>{t('eoba_invite_link_or_code')}</label>
                                <input
                                    type="text"
                                    style={styles.formInput}
                                    placeholder="Örn: https://karalevha.com/e-oba?davet=xyz123 veya xyz123"
                                    value={joinLinkInput}
                                    onChange={(e) => setJoinLinkInput(e.target.value)}
                                    required
                                    autoFocus
                                />
                            </div>

                            <div style={{ ...styles.modalFooter, marginTop: '20px' }}>
                                <button
                                    type="button"
                                    onClick={() => setAddJoinStep('choice')}
                                    style={styles.cancelBtn}
                                    disabled={joinLoading}
                                >
                                    {t('btn_back')}
                                </button>
                                <button
                                    type="submit"
                                    style={styles.primaryActionButton}
                                    disabled={joinLoading || !joinLinkInput.trim()}
                                >
                                    {joinLoading ? 'Katılınıyor...' : t('eoba_join_btn')}
                                </button>
                            </div>
                        </form>
                    )}
                </ModalWrapper>
            )}

            {/* 1. OBA OLUŞTURMA MODALI */}
            {modalType === 'create_oba' && (
                <ModalWrapper title="Yeni Bir E-Oba Kur" onClose={() => setModalType(null)}>
                    <form onSubmit={handleCreateOba}>
                        <div style={styles.formGroup}>
                            <label style={styles.formLabel}>Oba Adı</label>
                            <input
                                type="text"
                                style={styles.formInput}
                                placeholder="Örn: Voron & Maker Atölyesi"
                                value={obaForm.name}
                                onChange={(e) => setObaForm({ ...obaForm, name: e.target.value })}
                                required
                            />
                        </div>
                        <div style={styles.formGroup}>
                            <label style={styles.formLabel}>Açıklama</label>
                            <textarea
                                style={{ ...styles.formInput, height: '80px', resize: 'vertical' }}
                                placeholder="Obanın amacını ve maker topluluğunuzu tanıtın..."
                                value={obaForm.description}
                                onChange={(e) => setObaForm({ ...obaForm, description: e.target.value })}
                            />
                        </div>
                        <div style={styles.formGroup}>
                            <label style={styles.formLabel}>Gizlilik</label>
                            <select
                                style={styles.formInput}
                                value={obaForm.is_public}
                                onChange={(e) => setObaForm({ ...obaForm, is_public: Number(e.target.value) })}
                            >
                                <option value={1}>Herkese Açık (Tüm KaraLevha üyeleri görebilir)</option>
                                <option value={0}>Özel (Sadece davetle katılım)</option>
                            </select>
                        </div>
                        <div style={styles.modalFooter}>
                            <button type="button" onClick={() => setModalType(null)} style={styles.cancelBtn}>İptal</button>
                            <button type="submit" style={styles.primaryActionButton}>Obayı Kur</button>
                        </div>
                    </form>
                </ModalWrapper>
            )}

            {/* 2. SUNUCU (E-OBA) AYARLARI MODALI (Genel Ayarlar, Rol Yönetimi, E-Obayı Sil) */}
            {modalType === 'oba_settings' && (
                <ModalWrapper title={`Sunucu Ayarları — ${obaDetail?.name}`} onClose={() => setModalType(null)} width="720px">
                    {/* Sekmeler */}
                    <div style={styles.settingsTabBar}>
                        <button
                            type="button"
                            onClick={() => setSettingsTab('general')}
                            style={{
                                ...styles.settingsTabBtn,
                                borderBottom: settingsTab === 'general' ? `2px solid ${PRIMARY_BLUE}` : '2px solid transparent',
                                color: settingsTab === 'general' ? '#fff' : '#888'
                            }}
                        >
                            Genel Görünüm
                        </button>
                        <button
                            type="button"
                            onClick={() => setSettingsTab('roles')}
                            style={{
                                ...styles.settingsTabBtn,
                                borderBottom: settingsTab === 'roles' ? `2px solid ${PRIMARY_BLUE}` : '2px solid transparent',
                                color: settingsTab === 'roles' ? '#fff' : '#888'
                            }}
                        >
                            Rol & Tag Yönetimi
                        </button>
                        <button
                            type="button"
                            onClick={() => setSettingsTab('danger')}
                            style={{
                                ...styles.settingsTabBtn,
                                borderBottom: settingsTab === 'danger' ? '2px solid #ef4444' : '2px solid transparent',
                                color: settingsTab === 'danger' ? '#ef4444' : '#888'
                            }}
                        >
                            Tehlikeli Bölge
                        </button>
                    </div>

                    {/* SEKME 1: GENEL AYARLAR & KÜÇÜK RESİM */}
                    {settingsTab === 'general' && (
                        <form onSubmit={handleUpdateObaSettings} style={{ marginTop: '16px' }}>
                            <div style={styles.formGroup}>
                                <label style={styles.formLabel}>Oba Adı</label>
                                <input
                                    type="text"
                                    style={styles.formInput}
                                    value={obaSettingsForm.name}
                                    onChange={(e) => setObaSettingsForm({ ...obaSettingsForm, name: e.target.value })}
                                    required
                                />
                            </div>

                            <div style={styles.formGroup}>
                                <label style={styles.formLabel}>Açıklama</label>
                                <textarea
                                    style={{ ...styles.formInput, height: '70px', resize: 'vertical' }}
                                    value={obaSettingsForm.description}
                                    onChange={(e) => setObaSettingsForm({ ...obaSettingsForm, description: e.target.value })}
                                />
                            </div>

                            {/* KÜÇÜK RESİM (AVATAR) DÜZENLEME */}
                            <div style={styles.formGroup}>
                                <label style={styles.formLabel}>Oba Küçük Resmi (Avatar / Logo)</label>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '10px' }}>
                                    <div style={styles.avatarPreviewContainer}>
                                        {obaSettingsForm.avatar_url ? (
                                            <img src={obaSettingsForm.avatar_url} alt="Önizleme" style={styles.avatarPreviewImg} />
                                        ) : (
                                            <span style={{ fontSize: '13px', color: '#888' }}>LOGO</span>
                                        )}
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <input
                                            type="text"
                                            style={styles.formInput}
                                            placeholder="Görsel bağlantısı (https://... veya hazır simge seçin)"
                                            value={obaSettingsForm.avatar_url}
                                            onChange={(e) => setObaSettingsForm({ ...obaSettingsForm, avatar_url: e.target.value })}
                                        />
                                    </div>
                                </div>

                                {/* Hazır Dicebear Simge Presetleri */}
                                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                                    <span style={{ fontSize: '11px', color: '#888' }}>Hazır Simgeler:</span>
                                    {[
                                        { label: 'Robot', seed: 'robot' },
                                        { label: 'Maker', seed: 'maker' },
                                        { label: 'Siber', seed: 'cyber' },
                                        { label: 'Tasarım', seed: 'design' },
                                        { label: 'Rastgele', seed: Math.random().toString(36).substring(7) }
                                    ].map((preset) => (
                                        <button
                                            type="button"
                                            key={preset.label}
                                            onClick={() => setObaSettingsForm({
                                                ...obaSettingsForm,
                                                avatar_url: `https://api.dicebear.com/7.x/bottts/svg?seed=${preset.seed}`
                                            })}
                                            style={styles.presetAvatarBtn}
                                        >
                                            {preset.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div style={styles.formGroup}>
                                <label style={styles.formLabel}>Gizlilik</label>
                                <select
                                    style={styles.formInput}
                                    value={obaSettingsForm.is_public}
                                    onChange={(e) => setObaSettingsForm({ ...obaSettingsForm, is_public: Number(e.target.value) })}
                                >
                                    <option value={1}>Herkese Açık (Tüm üyeler görebilir)</option>
                                    <option value={0}>Özel (Sadece davetle katılım)</option>
                                </select>
                            </div>

                            <div style={styles.modalFooter}>
                                <button type="button" onClick={() => setModalType(null)} style={styles.cancelBtn}>İptal</button>
                                <button type="submit" style={styles.primaryActionButton}>Değişiklikleri Kaydet</button>
                            </div>
                        </form>
                    )}

                    {/* SEKME 2: ROL & TAG YÖNETİMİ */}
                    {settingsTab === 'roles' && (
                        <div style={{ marginTop: '16px' }}>
                            <h4 style={{ margin: '0 0 10px 0', color: PRIMARY_BLUE }}>Yeni Rol (Tag) Oluştur</h4>
                            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: '10px', alignItems: 'center' }}>
                                <input
                                    type="text"
                                    style={styles.formInput}
                                    placeholder="Rol Adı (örn: Mühendis)"
                                    value={roleForm.name}
                                    onChange={(e) => setRoleForm({ ...roleForm, name: e.target.value })}
                                />
                                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                    <input
                                        type="color"
                                        value={roleForm.color}
                                        onChange={(e) => setRoleForm({ ...roleForm, color: e.target.value })}
                                        style={{ width: '38px', height: '36px', border: 'none', background: 'transparent', cursor: 'pointer' }}
                                    />
                                    <span style={{ fontSize: '12px', color: '#888' }}>{roleForm.color}</span>
                                </div>
                                <input
                                    type="number"
                                    style={styles.formInput}
                                    placeholder="Hiyerarşi"
                                    value={roleForm.position}
                                    onChange={(e) => setRoleForm({ ...roleForm, position: Number(e.target.value) })}
                                    title="Hiyerarşi Derecesi (Yüksek olan üstte çıkar)"
                                />
                                <button
                                    onClick={async () => {
                                        if (!roleForm.name.trim()) return;
                                        try {
                                            const res = await fetch(`${API_URL}/api/eoba/obalar/${activeObaId}/roles`, {
                                                method: 'POST',
                                                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}`, 'Content-Type': 'application/json' },
                                                body: JSON.stringify({
                                                    name: roleForm.name,
                                                    color: roleForm.color,
                                                    position: roleForm.position,
                                                    permissions: roleForm.permissions,
                                                    user_id: currentUser.id
                                                })
                                            });
                                            if (res.ok) {
                                                showToast("Rol oluşturuldu!");
                                                setRoleForm({ name: '', color: '#0066ff', position: 10, permissions: ['view', 'write'] });
                                                loadObaData(activeObaId);
                                            }
                                        } catch {
                                            showToast("Hata oluştu.");
                                        }
                                    }}
                                    style={styles.primaryActionButton}
                                >
                                    + Ekle
                                </button>
                            </div>

                            {/* İzin Kontrol Kutucukları */}
                            <div style={{ marginTop: '12px', display: 'flex', gap: '15px', flexWrap: 'wrap', fontSize: '12px', color: '#ccc' }}>
                                {[
                                    { key: 'view', label: 'Görüntüleme' },
                                    { key: 'write', label: 'Yazma & Katkı' },
                                    { key: 'manage_content', label: 'İçerik Silme' },
                                    { key: 'manage_structure', label: 'Çadır/Masa/Levha Açma' },
                                    { key: 'manage_roles', label: 'Rol Yönetimi' },
                                    { key: 'admin', label: 'Tam Yetkili (Admin)' }
                                ].map(perm => (
                                    <label key={perm.key} style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
                                        <input
                                            type="checkbox"
                                            checked={roleForm.permissions.includes(perm.key)}
                                            onChange={(e) => {
                                                const next = e.target.checked
                                                    ? [...roleForm.permissions, perm.key]
                                                    : roleForm.permissions.filter(p => p !== perm.key);
                                                setRoleForm({ ...roleForm, permissions: next });
                                            }}
                                        />
                                        {perm.label}
                                    </label>
                                ))}
                            </div>

                            <div style={styles.vDividerHorizontal} />

                            <h4 style={{ margin: '15px 0 10px 0', color: '#fff' }}>Mevcut Roller</h4>
                            <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                                {roles.map((r) => (
                                    <div key={r.id} style={styles.roleItemRow}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <div style={{ width: '14px', height: '14px', borderRadius: '50%', backgroundColor: r.color }} />
                                            <span style={{ fontWeight: 'bold', color: r.color }}>{r.name}</span>
                                            <span style={{ fontSize: '11px', color: '#888' }}>(Öncelik: {r.position})</span>
                                            <span style={{ fontSize: '11px', color: '#aaa' }}>{r.member_count} üye</span>
                                        </div>
                                        <div>
                                            {r.is_default !== 1 && (
                                                <button
                                                    onClick={async () => {
                                                        if (!window.confirm("Bu rolü silmek istediğinize emin misiniz?")) return;
                                                        const res = await fetch(`${API_URL}/api/eoba/obalar/${activeObaId}/roles/${r.id}?user_id=${currentUser.id}`, { method: 'DELETE' , headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } });
                                                        if (res.ok) {
                                                            showToast("Rol silindi.");
                                                            loadObaData(activeObaId);
                                                        }
                                                    }}
                                                    style={styles.miniDeleteButton}
                                                >
                                                    Sil
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* SEKME 3: TEHLİKELİ BÖLGE (OBAYI SİL) */}
                    {settingsTab === 'danger' && (
                        <div style={{ marginTop: '20px' }}>
                            <div style={styles.dangerZoneBox}>
                                <h4 style={{ color: '#ef4444', margin: '0 0 8px 0' }}>Bu E-Obayı Kalıcı Olarak Sil</h4>
                                <p style={{ color: '#94a3b8', fontSize: '13px', lineHeight: '1.6', margin: '0 0 16px 0' }}>
                                    Bu işlem geri alınamaz. Bu obaya ait tüm çadırlar, masalar, levhalar, sohbet akışları, Excel tabloları ve görev kartları tamamen silinecektir.
                                </p>
                                <button
                                    type="button"
                                    onClick={handleDeleteOba}
                                    style={styles.dangerDeleteBtn}
                                >
                                    E-Obayı Kalıcı Olarak Sil
                                </button>
                            </div>
                        </div>
                    )}
                </ModalWrapper>
            )}

            {/* 3. ÇADIR OLUŞTURMA MODALI */}
            {modalType === 'create_cadir' && (
                <ModalWrapper title="Yeni Çadır (Kategori) Aç" onClose={() => setModalType(null)}>
                    <form onSubmit={handleCreateCadir}>
                        <div style={styles.formGroup}>
                            <label style={styles.formLabel}>Çadır Adı</label>
                            <input
                                type="text"
                                style={styles.formInput}
                                placeholder="Örn: Mekanik & 3D Tasarım"
                                value={cadirForm.name}
                                onChange={(e) => setCadirForm({ ...cadirForm, name: e.target.value })}
                                required
                            />
                        </div>
                        <div style={styles.modalFooter}>
                            <button type="button" onClick={() => setModalType(null)} style={styles.cancelBtn}>İptal</button>
                            <button type="submit" style={styles.primaryActionButton}>Çadırı Aç</button>
                        </div>
                    </form>
                </ModalWrapper>
            )}

            {/* 4. MASA OLUŞTURMA MODALI */}
            {modalType === 'create_masa' && (
                <ModalWrapper title={`"${selectedTarget?.name}" Çadırına Masa Aç`} onClose={() => setModalType(null)}>
                    <form onSubmit={handleCreateMasa}>
                        <div style={styles.formGroup}>
                            <label style={styles.formLabel}>Masa Adı</label>
                            <input
                                type="text"
                                style={styles.formInput}
                                placeholder="Örn: Klipper Ayarları Masası"
                                value={masaForm.name}
                                onChange={(e) => setMasaForm({ ...masaForm, name: e.target.value })}
                                required
                            />
                        </div>
                        <div style={styles.modalFooter}>
                            <button type="button" onClick={() => setModalType(null)} style={styles.cancelBtn}>İptal</button>
                            <button type="submit" style={styles.primaryActionButton}>Masayı Aç</button>
                        </div>
                    </form>
                </ModalWrapper>
            )}

            {/* 5. LEVHA OLUŞTURMA MODALI */}
            {modalType === 'create_levha' && (
                <ModalWrapper title={`"${selectedTarget?.name}" Masasına Levha Ekle`} onClose={() => setModalType(null)}>
                    <form onSubmit={handleCreateLevha}>
                        <div style={styles.formGroup}>
                            <label style={styles.formLabel}>Levha Başlığı</label>
                            <input
                                type="text"
                                style={styles.formInput}
                                placeholder="Örn: Parça BOM Listesi"
                                value={levhaForm.title}
                                onChange={(e) => setLevhaForm({ ...levhaForm, title: e.target.value })}
                                required
                            />
                        </div>

                        <div style={styles.formGroup}>
                            <label style={styles.formLabel}>Levha Türü</label>
                            <div style={styles.levhaTypeGrid}>
                                {[
                                    { type: 'chat', label: 'Sohbet Levhası', desc: 'Anlık maker mesajlaşması ve dosya paylaşımı.' },
                                    { type: 'duyuru', label: 'Duyuru Levhası', desc: 'Sabitlenen önemli duyurular ve bültenler.' },
                                    { type: 'tablo', label: 'Tablo Levhası (Excel)', desc: 'Malzeme listeleri (BOM), filament stoğu ve fiyatlar.' },
                                    { type: 'kanban', label: 'Görev Levhası', desc: 'Süreç ve sprint takibi için Kanban panosu.' }
                                ].map((item) => (
                                    <div
                                        key={item.type}
                                        onClick={() => setLevhaForm({ ...levhaForm, type: item.type, icon: '' })}
                                        style={{
                                            ...styles.levhaTypeCard,
                                            borderColor: levhaForm.type === item.type ? PRIMARY_BLUE : '#2a2a38',
                                            backgroundColor: levhaForm.type === item.type ? 'rgba(0, 102, 255, 0.1)' : '#16161f'
                                        }}
                                    >
                                        <div style={{ fontWeight: 'bold', fontSize: '14px', marginBottom: '4px' }}>{item.label}</div>
                                        <div style={{ fontSize: '11px', color: '#888' }}>{item.desc}</div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div style={styles.modalFooter}>
                            <button type="button" onClick={() => setModalType(null)} style={styles.cancelBtn}>İptal</button>
                            <button type="submit" style={styles.primaryActionButton}>Levhayı Ekle</button>
                        </div>
                    </form>
                </ModalWrapper>
            )}

            {/* 6. ÜYEYE ROL ATAMA MODALI */}
            {modalType === 'assign_role' && selectedMember && (
                <ModalWrapper title={`${selectedMember.display_name} — Rolleri Yönet`} onClose={() => setModalType(null)}>
                    <div style={{ marginBottom: '15px', color: '#ccc', fontSize: '13px' }}>
                        Bu üyeye ait tag/rolleri işaretleyip kaydedin:
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '250px', overflowY: 'auto' }}>
                        {roles.filter(r => r.is_default !== 1).map((r) => {
                            const isAssigned = selectedMember.roles?.some(mr => mr.id === r.id);
                            return (
                                <label
                                    key={r.id}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '10px',
                                        padding: '8px 12px',
                                        backgroundColor: '#16161f',
                                        borderRadius: '6px',
                                        cursor: 'pointer'
                                    }}
                                >
                                    <input
                                        type="checkbox"
                                        checked={isAssigned}
                                        onChange={async (e) => {
                                            const currentRoleIds = (selectedMember.roles || []).map(x => x.id);
                                            const nextRoleIds = e.target.checked
                                                ? [...currentRoleIds, r.id]
                                                : currentRoleIds.filter(id => id !== r.id);

                                            try {
                                                const res = await fetch(`${API_URL}/api/eoba/obalar/${activeObaId}/members/${selectedMember.user_id}/roles`, {
                                                    method: 'POST',
                                                    headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}`, 'Content-Type': 'application/json' },
                                                    body: JSON.stringify({ role_ids: nextRoleIds, user_id: currentUser.id })
                                                });
                                                if (res.ok) {
                                                    showToast("Rol güncellendi.");
                                                    loadObaData(activeObaId);
                                                    setSelectedMember({
                                                        ...selectedMember,
                                                        roles: roles.filter(x => nextRoleIds.includes(x.id))
                                                    });
                                                }
                                            } catch {
                                                showToast("Hata oluştu.");
                                            }
                                        }}
                                    />
                                    <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: r.color }} />
                                    <span style={{ color: r.color, fontWeight: 'bold' }}>{r.name}</span>
                                </label>
                            );
                        })}
                    </div>

                    <div style={styles.modalFooter}>
                        <button type="button" onClick={() => setModalType(null)} style={styles.primaryActionButton}>Tamam</button>
                    </div>
                </ModalWrapper>
            )}

            {/* 7. HEDEF YETKİLERİ (PERMISSION OVERRIDES) MODALI */}
            {modalType === 'permissions' && selectedTarget && (
                <ModalWrapper title={`İzin Kuralları: ${selectedTarget.name}`} onClose={() => setModalType(null)} width="650px">
                    <p style={{ color: '#888', fontSize: '13px', margin: '0 0 15px 0' }}>
                        Bu {selectedTarget.type === 'cadir' ? 'Çadır' : selectedTarget.type === 'masa' ? 'Masa' : 'Levha'} için rollere özel görme ve yazma kısıtlamaları belirleyin:
                    </p>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '300px', overflowY: 'auto' }}>
                        {roles.map((r) => {
                            const override = targetPerms.find(p => p.role_id === r.id);
                            const allows = override ? override.allow_perms : [];
                            const denies = override ? override.deny_perms : [];

                            const isViewAllowed = allows.includes('view');
                            const isViewDenied = denies.includes('view');

                            const isWriteAllowed = allows.includes('write');
                            const isWriteDenied = denies.includes('write');

                            const handlePermToggle = (permKey, status) => {
                                let nextAllows = [...allows];
                                let nextDenies = [...denies];

                                if (status === 'allow') {
                                    nextAllows = Array.from(new Set([...nextAllows, permKey]));
                                    nextDenies = nextDenies.filter(x => x !== permKey);
                                } else if (status === 'deny') {
                                    nextDenies = Array.from(new Set([...nextDenies, permKey]));
                                    nextAllows = nextAllows.filter(x => x !== permKey);
                                } else {
                                    nextAllows = nextAllows.filter(x => x !== permKey);
                                    nextDenies = nextDenies.filter(x => x !== permKey);
                                }

                                handleSavePermissionOverride(r.id, nextAllows, nextDenies);
                            };

                            return (
                                <div key={r.id} style={styles.permRoleBlock}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '150px' }}>
                                        <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: r.color }} />
                                        <span style={{ fontWeight: 'bold', color: r.color }}>{r.name}</span>
                                    </div>

                                    {/* Görüntüleme İzni */}
                                    <div style={styles.permButtonToggleGroup}>
                                        <span style={{ fontSize: '12px', color: '#aaa', marginRight: '5px' }}>Görme:</span>
                                        <button
                                            onClick={() => handlePermToggle('view', isViewAllowed ? 'inherit' : 'allow')}
                                            style={{
                                                ...styles.toggleBtn,
                                                backgroundColor: isViewAllowed ? '#10b981' : '#222',
                                                color: isViewAllowed ? '#000' : '#fff'
                                            }}
                                            title="İzin Ver"
                                        >
                                            ✓
                                        </button>
                                        <button
                                            onClick={() => handlePermToggle('view', isViewDenied ? 'inherit' : 'deny')}
                                            style={{
                                                ...styles.toggleBtn,
                                                backgroundColor: isViewDenied ? '#ef4444' : '#222',
                                                color: isViewDenied ? '#fff' : '#888'
                                            }}
                                            title="Reddet / Kilitli"
                                        >
                                            ✕
                                        </button>
                                    </div>

                                    {/* Yazma İzni */}
                                    <div style={styles.permButtonToggleGroup}>
                                        <span style={{ fontSize: '12px', color: '#aaa', marginRight: '5px' }}>Yazma:</span>
                                        <button
                                            onClick={() => handlePermToggle('write', isWriteAllowed ? 'inherit' : 'allow')}
                                            style={{
                                                ...styles.toggleBtn,
                                                backgroundColor: isWriteAllowed ? '#10b981' : '#222',
                                                color: isWriteAllowed ? '#000' : '#fff'
                                            }}
                                            title="İzin Ver"
                                        >
                                            ✓
                                        </button>
                                        <button
                                            onClick={() => handlePermToggle('write', isWriteDenied ? 'inherit' : 'deny')}
                                            style={{
                                                ...styles.toggleBtn,
                                                backgroundColor: isWriteDenied ? '#ef4444' : '#222',
                                                color: isWriteDenied ? '#fff' : '#888'
                                            }}
                                            title="Reddet"
                                        >
                                            ✕
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <div style={styles.modalFooter}>
                        <button type="button" onClick={() => setModalType(null)} style={styles.primaryActionButton}>Tamam</button>
                    </div>
                </ModalWrapper>
            )}
        </div>
    );
}

// ----------------- ALT BİLEŞEN 1: SOHBET LEVHASI -----------------

function ChatLevhasi({ levha, user, showToast }) {
    const [messages, setMessages] = useState([]);
    const [text, setText] = useState('');
    const [sending, setSending] = useState(false);
    const messagesEndRef = useRef(null);

    const loadMessages = async () => {
        try {
            const res = await fetch(`${API_URL}/api/eoba/levhalar/${levha.id}/chat`);
            if (res.ok) {
                setMessages(await res.json());
            }
        } catch (err) {
            console.error("Mesajlar alınamadı:", err);
        }
    };

    useEffect(() => {
        loadMessages();
        const interval = setInterval(loadMessages, 3000);
        return () => clearInterval(interval);
    }, [levha.id]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!text.trim() || sending) return;
        if (!user) return showToast("Mesaj atmak için giriş yapmalısınız.");

        setSending(true);
        try {
            const res = await fetch(`${API_URL}/api/eoba/levhalar/${levha.id}/chat`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    levha_id: levha.id,
                    user_id: user.id,
                    content: text
                })
            });
            if (res.ok) {
                setText('');
                loadMessages();
            } else {
                const data = await res.json();
                showToast(data.detail || "Bu levhaya yazma yetkiniz yok.");
            }
        } catch {
            showToast("Mesaj gönderilemedi.");
        } finally {
            setSending(false);
        }
    };

    const handleDeleteMessage = async (msgId) => {
        try {
            const res = await fetch(`${API_URL}/api/eoba/levhalar/chat/${msgId}?user_id=${user.id}`, { method: 'DELETE' , headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } });
            if (res.ok) {
                loadMessages();
            }
        } catch {
            showToast("Silinemedi.");
        }
    };

    return (
        <div style={styles.chatContainer}>
            <div style={styles.chatMessagesArea}>
                {messages.length === 0 ? (
                    <div style={styles.chatEmptyMessage}>
                        Bu levhada henüz bir mesaj yok. İlk mesajı yazarak tartışmayı başlatın.
                    </div>
                ) : (
                    messages.map((msg) => (
                        <div key={msg.id} style={styles.chatMessageRow}>
                            {msg.profile_image ? (
                                <img src={msg.profile_image} alt="Avatar" style={styles.chatAvatar} />
                            ) : (
                                <div style={styles.chatAvatarPlaceholder}>👤</div>
                            )}
                            <div style={{ flex: 1 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{
                                        fontWeight: 'bold',
                                        fontSize: '14px',
                                        color: msg.user_role?.color || '#fff'
                                    }}>
                                        {msg.display_name}
                                    </span>
                                    {msg.user_role && (
                                        <span style={{ ...styles.roleMiniTag, borderColor: msg.user_role.color, color: msg.user_role.color }}>
                                            {msg.user_role.name}
                                        </span>
                                    )}
                                    <span style={styles.chatTimestamp}>
                                        {parseUTC(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                                <div style={styles.chatContentText}>{msg.content}</div>
                            </div>
                            {user && (user.id === msg.user_id || user.role === 'admin') && (
                                <button
                                    onClick={() => handleDeleteMessage(msg.id)}
                                    style={styles.chatDeleteBtn}
                                    title="Mesajı Sil"
                                >
                                    ×
                                </button>
                            )}
                        </div>
                    ))
                )}
                <div ref={messagesEndRef} />
            </div>

            <form onSubmit={handleSendMessage} style={styles.chatInputBar}>
                <input
                    type="text"
                    placeholder={`"${levha.title}" levhasında mesaj yaz...`}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    style={styles.chatInput}
                    disabled={!user}
                />
                <button
                    type="submit"
                    disabled={!user || !text.trim() || sending}
                    style={{
                        ...styles.chatSendBtn,
                        opacity: (!user || !text.trim()) ? 0.5 : 1
                    }}
                >
                    Gönder
                </button>
            </form>
        </div>
    );
}

// ----------------- ALT BİLEŞEN 2: DUYURU LEVHASI -----------------

function DuyuruLevhasi({ levha, user, showToast }) {
    const [announcements, setAnnouncements] = useState([]);
    const [showNewModal, setShowNewModal] = useState(false);
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [isPinned, setIsPinned] = useState(0);

    const loadAnnouncements = async () => {
        try {
            const res = await fetch(`${API_URL}/api/eoba/levhalar/${levha.id}/announcements`);
            if (res.ok) setAnnouncements(await res.json());
        } catch (err) {
            console.error("Duyurular alınamadı:", err);
        }
    };

    useEffect(() => {
        loadAnnouncements();
    }, [levha.id]);

    const handleCreateAnnouncement = async (e) => {
        e.preventDefault();
        if (!title.trim() || !content.trim()) return;
        try {
            const res = await fetch(`${API_URL}/api/eoba/levhalar/${levha.id}/announcements`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    levha_id: levha.id,
                    user_id: user.id,
                    title,
                    content,
                    is_pinned: isPinned
                })
            });
            if (res.ok) {
                showToast("Duyuru yayınlandı.");
                setTitle('');
                setContent('');
                setIsPinned(0);
                setShowNewModal(false);
                loadAnnouncements();
            } else {
                const data = await res.json();
                showToast(data.detail || "Duyuru yayınlama yetkiniz yok.");
            }
        } catch {
            showToast("Hata oluştu.");
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Bu duyuruyu silmek istiyor musunuz?")) return;
        try {
            const res = await fetch(`${API_URL}/api/eoba/levhalar/announcements/${id}?user_id=${user.id}`, { method: 'DELETE' , headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } });
            if (res.ok) {
                showToast("Duyuru silindi.");
                loadAnnouncements();
            }
        } catch {
            showToast("Silinemedi.");
        }
    };

    return (
        <div style={styles.announcementContainer}>
            <div style={styles.announcementHeaderBar}>
                <div>
                    <h3 style={{ margin: 0, color: '#fff' }}>{levha.title}</h3>
                    <span style={{ fontSize: '12px', color: '#888' }}>Resmi duyurular ve kararlar</span>
                </div>
                {user && (
                    <button onClick={() => setShowNewModal(true)} style={styles.primaryActionButton}>
                        + Yeni Duyuru Yayınla
                    </button>
                )}
            </div>

            <div style={styles.announcementList}>
                {announcements.length === 0 ? (
                    <div style={styles.emptyCenterNotice}>Henüz yayınlanmış bir duyuru bulunmuyor.</div>
                ) : (
                    announcements.map((ann) => (
                        <div
                            key={ann.id}
                            style={{
                                ...styles.announcementCard,
                                borderLeft: ann.is_pinned ? `4px solid ${PRIMARY_BLUE}` : '4px solid #333'
                            }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    {ann.is_pinned === 1 && (
                                        <span style={{ fontSize: '10px', background: PRIMARY_BLUE, color: '#fff', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>
                                            SABİT
                                        </span>
                                    )}
                                    <h4 style={styles.annTitle}>{ann.title}</h4>
                                </div>
                                {user && (
                                    <button onClick={() => handleDelete(ann.id)} style={styles.miniDeleteButton}>
                                        Sil
                                    </button>
                                )}
                            </div>
                            <p style={styles.annContent}>{ann.content}</p>
                            <div style={styles.annFooter}>
                                <span>Yayınlayan: <strong>{ann.display_name}</strong></span>
                                <span>{parseUTC(ann.created_at).toLocaleDateString('tr-TR')}</span>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {showNewModal && (
                <ModalWrapper title="Yeni Duyuru Yayınla" onClose={() => setShowNewModal(false)}>
                    <form onSubmit={handleCreateAnnouncement}>
                        <div style={styles.formGroup}>
                            <label style={styles.formLabel}>Başlık</label>
                            <input
                                type="text"
                                style={styles.formInput}
                                placeholder="Örn: Hafta Sonu Atölye Bakımı ve Dilimleme Eğitimi"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                required
                            />
                        </div>
                        <div style={styles.formGroup}>
                            <label style={styles.formLabel}>İçerik</label>
                            <textarea
                                style={{ ...styles.formInput, height: '120px', resize: 'vertical' }}
                                placeholder="Duyuru detaylarını buraya yazın..."
                                value={content}
                                onChange={(e) => setContent(e.target.value)}
                                required
                            />
                        </div>
                        <div style={styles.formGroup}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: '#ccc' }}>
                                <input
                                    type="checkbox"
                                    checked={isPinned === 1}
                                    onChange={(e) => setIsPinned(e.target.checked ? 1 : 0)}
                                />
                                Bu duyuruyu en başa sabitle
                            </label>
                        </div>
                        <div style={styles.modalFooter}>
                            <button type="button" onClick={() => setShowNewModal(false)} style={styles.cancelBtn}>İptal</button>
                            <button type="submit" style={styles.primaryActionButton}>Yayınla</button>
                        </div>
                    </form>
                </ModalWrapper>
            )}
        </div>
    );
}

// ----------------- ALT BİLEŞEN 3: TABLO LEVHASI (EXCEL / BOM) -----------------

function TabloLevhasi({ levha, user, showToast }) {
    const [columns, setColumns] = useState([]);
    const [rows, setRows] = useState([]);
    const [newRowData, setNewRowData] = useState({});
    const [showColumnModal, setShowColumnModal] = useState(false);
    const [colListString, setColListString] = useState('');

    const loadTable = async () => {
        try {
            const res = await fetch(`${API_URL}/api/eoba/levhalar/${levha.id}/table`);
            if (res.ok) {
                const data = await res.json();
                setColumns(data.columns || []);
                setRows(data.rows || []);
                setColListString((data.columns || []).join(', '));
            }
        } catch (err) {
            console.error("Tablo yüklenemedi:", err);
        }
    };

    useEffect(() => {
        loadTable();
    }, [levha.id]);

    const handleAddRow = async (e) => {
        e.preventDefault();
        if (!user) return showToast("Veri eklemek için giriş yapmalısınız.");
        try {
            const res = await fetch(`${API_URL}/api/eoba/levhalar/${levha.id}/table/row`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    row_data: newRowData,
                    user_id: user.id
                })
            });
            if (res.ok) {
                showToast("Satır eklendi.");
                setNewRowData({});
                loadTable();
            } else {
                const data = await res.json();
                showToast(data.detail || "Yetkiniz yetersiz.");
            }
        } catch {
            showToast("Hata oluştu.");
        }
    };

    const handleUpdateCell = async (rowId, colName, value) => {
        const row = rows.find(r => r.id === rowId);
        if (!row) return;
        const nextData = { ...(row.data || {}), [colName]: value };

        try {
            await fetch(`${API_URL}/api/eoba/levhalar/table/row/${rowId}`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    row_data: nextData,
                    user_id: user?.id || 1
                })
            });
            setRows(prev => prev.map(r => r.id === rowId ? { ...r, data: nextData } : r));
        } catch {
            showToast("Güncellenemedi.");
        }
    };

    const handleDeleteRow = async (rowId) => {
        try {
            const res = await fetch(`${API_URL}/api/eoba/levhalar/table/row/${rowId}?user_id=${user.id}`, { method: 'DELETE' , headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } });
            if (res.ok) {
                loadTable();
            }
        } catch {
            showToast("Satır silinemedi.");
        }
    };

    const handleSaveColumns = async (e) => {
        e.preventDefault();
        const nextCols = colListString.split(',').map(s => s.trim()).filter(Boolean);
        if (nextCols.length === 0) return;
        try {
            const res = await fetch(`${API_URL}/api/eoba/levhalar/${levha.id}/table/config`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    columns: nextCols,
                    user_id: user.id
                })
            });
            if (res.ok) {
                showToast("Sütunlar güncellendi.");
                setShowColumnModal(false);
                loadTable();
            }
        } catch {
            showToast("Hata oluştu.");
        }
    };

    return (
        <div style={styles.tableContainer}>
            <div style={styles.tableToolbar}>
                <div>
                    <h3 style={{ margin: 0, color: '#fff' }}>{levha.title}</h3>
                    <span style={{ fontSize: '12px', color: '#888' }}>Dinamik Excel / BOM veri tablosu</span>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                    {user && (
                        <button onClick={() => setShowColumnModal(true)} style={styles.secondaryBtn}>
                            Sütunları Düzenle
                        </button>
                    )}
                </div>
            </div>

            <div style={styles.tableScrollWrapper}>
                <table style={styles.excelTable}>
                    <thead>
                        <tr>
                            <th style={styles.tableHeaderCellIndex}>#</th>
                            {columns.map((col, idx) => (
                                <th key={idx} style={styles.tableHeaderCell}>{col}</th>
                            ))}
                            <th style={styles.tableHeaderCellAction}>İşlem</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row, rIdx) => (
                            <tr key={row.id} style={styles.tableRow}>
                                <td style={styles.tableCellIndex}>{rIdx + 1}</td>
                                {columns.map((col, cIdx) => (
                                    <td key={cIdx} style={styles.tableCell}>
                                        <input
                                            type="text"
                                            value={row.data?.[col] ?? ''}
                                            onChange={(e) => handleUpdateCell(row.id, col, e.target.value)}
                                            style={styles.cellInput}
                                            disabled={!user}
                                        />
                                    </td>
                                ))}
                                <td style={styles.tableCellAction}>
                                    {user && (
                                        <button onClick={() => handleDeleteRow(row.id)} style={styles.miniDeleteButton}>
                                            ×
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))}

                        {user && (
                            <tr style={styles.tableNewRow}>
                                <td style={styles.tableCellIndex}>+</td>
                                {columns.map((col, cIdx) => (
                                    <td key={cIdx} style={styles.tableCell}>
                                        <input
                                            type="text"
                                            placeholder={`Yeni ${col}...`}
                                            value={newRowData[col] || ''}
                                            onChange={(e) => setNewRowData({ ...newRowData, [col]: e.target.value })}
                                            style={styles.cellNewInput}
                                        />
                                    </td>
                                ))}
                                <td style={styles.tableCellAction}>
                                    <button onClick={handleAddRow} style={styles.miniAddBtn}>
                                        Ekle
                                    </button>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {showColumnModal && (
                <ModalWrapper title="Tablo Sütunlarını Ayarla" onClose={() => setShowColumnModal(false)}>
                    <form onSubmit={handleSaveColumns}>
                        <div style={styles.formGroup}>
                            <label style={styles.formLabel}>Sütun Başlıkları (Virgülle ayırarak yazın)</label>
                            <input
                                type="text"
                                style={styles.formInput}
                                value={colListString}
                                onChange={(e) => setColListString(e.target.value)}
                                placeholder="Parça Adı, Miktar, Fiyat, Tedarikçi, Durum"
                                required
                            />
                        </div>
                        <div style={styles.modalFooter}>
                            <button type="button" onClick={() => setShowColumnModal(false)} style={styles.cancelBtn}>İptal</button>
                            <button type="submit" style={styles.primaryActionButton}>Kaydet</button>
                        </div>
                    </form>
                </ModalWrapper>
            )}
        </div>
    );
}

// ----------------- ALT BİLEŞEN 4: GÖREV TAKİP LEVHASI (KANBAN) -----------------

function KanbanLevhasi({ levha, user, members, showToast }) {
    const [columns, setColumns] = useState([]);
    const [cards, setCards] = useState([]);
    const [showCardModal, setShowCardModal] = useState(false);
    const [targetCol, setTargetCol] = useState('');
    const [cardForm, setCardForm] = useState({ title: '', description: '', tag: 'Maker', assigned_user_id: '' });

    const loadKanban = async () => {
        try {
            const res = await fetch(`${API_URL}/api/eoba/levhalar/${levha.id}/kanban`);
            if (res.ok) {
                const data = await res.json();
                setColumns(data.columns || ["Yapılacak", "Devam Ediyor", "Tamamlandı"]);
                setCards(data.cards || []);
            }
        } catch (err) {
            console.error("Kanban yüklenemedi:", err);
        }
    };

    useEffect(() => {
        loadKanban();
    }, [levha.id]);

    const handleCreateCard = async (e) => {
        e.preventDefault();
        if (!cardForm.title.trim()) return;
        try {
            const res = await fetch(`${API_URL}/api/eoba/levhalar/${levha.id}/kanban/card`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    levha_id: levha.id,
                    column_name: targetCol || columns[0],
                    title: cardForm.title,
                    description: cardForm.description,
                    tag: cardForm.tag,
                    assigned_user_id: cardForm.assigned_user_id ? Number(cardForm.assigned_user_id) : null,
                    user_id: user?.id || 1
                })
            });
            if (res.ok) {
                showToast("Görev kartı eklendi.");
                setShowCardModal(false);
                setCardForm({ title: '', description: '', tag: 'Maker', assigned_user_id: '' });
                loadKanban();
            }
        } catch {
            showToast("Hata oluştu.");
        }
    };

    const handleMoveCard = async (cardId, nextColumn) => {
        try {
            const res = await fetch(`${API_URL}/api/eoba/levhalar/kanban/card/${cardId}`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    column_name: nextColumn,
                    user_id: user?.id || 1
                })
            });
            if (res.ok) {
                setCards(prev => prev.map(c => c.id === cardId ? { ...c, column_name: nextColumn } : c));
            }
        } catch {
            showToast("Taşınamadı.");
        }
    };

    const handleDeleteCard = async (cardId) => {
        try {
            const res = await fetch(`${API_URL}/api/eoba/levhalar/kanban/card/${cardId}?user_id=${user?.id || 1}`, { method: 'DELETE' , headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } });
            if (res.ok) {
                loadKanban();
            }
        } catch {
            showToast("Silinemedi.");
        }
    };

    return (
        <div style={styles.kanbanContainer}>
            <div style={styles.kanbanColumnsWrapper}>
                {columns.map((colName, colIdx) => {
                    const colCards = cards.filter(c => c.column_name === colName);
                    return (
                        <div key={colName} style={styles.kanbanColumn}>
                            <div style={styles.kanbanColumnHeader}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={styles.colBadge}>{colCards.length}</span>
                                    <span style={{ fontWeight: 'bold', color: '#fff' }}>{colName}</span>
                                </div>
                                {user && (
                                    <button
                                        onClick={() => {
                                            setTargetCol(colName);
                                            setShowCardModal(true);
                                        }}
                                        style={styles.colAddBtn}
                                        title="Bu Sütuna Görev Ekle"
                                    >
                                        +
                                    </button>
                                )}
                            </div>

                            <div style={styles.kanbanCardList}>
                                {colCards.map((card) => (
                                    <div key={card.id} style={styles.kanbanCard}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                            {card.tag && (
                                                <span style={styles.cardTag}>{card.tag}</span>
                                            )}
                                            {user && (
                                                <button onClick={() => handleDeleteCard(card.id)} style={styles.miniDeleteButton}>
                                                    ×
                                                </button>
                                            )}
                                        </div>

                                        <div style={styles.cardTitle}>{card.title}</div>
                                        {card.description && (
                                            <div style={styles.cardDescription}>{card.description}</div>
                                        )}

                                        <div style={styles.cardFooter}>
                                            <span style={styles.cardAssignee}>
                                                {card.assigned_name || 'Atanmamış'}
                                            </span>

                                            <div style={{ display: 'flex', gap: '4px' }}>
                                                {colIdx > 0 && (
                                                    <button
                                                        onClick={() => handleMoveCard(card.id, columns[colIdx - 1])}
                                                        style={styles.moveBtn}
                                                        title={`Taşı: ${columns[colIdx - 1]}`}
                                                    >
                                                        ◀
                                                    </button>
                                                )}
                                                {colIdx < columns.length - 1 && (
                                                    <button
                                                        onClick={() => handleMoveCard(card.id, columns[colIdx + 1])}
                                                        style={styles.moveBtn}
                                                        title={`Taşı: ${columns[colIdx + 1]}`}
                                                    >
                                                        ▶
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}

                                {user && (
                                    <button
                                        onClick={() => {
                                            setTargetCol(colName);
                                            setShowCardModal(true);
                                        }}
                                        style={styles.addCardUnderColumnBtn}
                                    >
                                        + Kart Ekle
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {showCardModal && (
                <ModalWrapper title={`"${targetCol}" Sütununa Görev Ekle`} onClose={() => setShowCardModal(false)}>
                    <form onSubmit={handleCreateCard}>
                        <div style={styles.formGroup}>
                            <label style={styles.formLabel}>Görev Başlığı</label>
                            <input
                                type="text"
                                style={styles.formInput}
                                placeholder="Örn: Gantry Montajı & Kayış Gerginlik Ayarı"
                                value={cardForm.title}
                                onChange={(e) => setCardForm({ ...cardForm, title: e.target.value })}
                                required
                            />
                        </div>
                        <div style={styles.formGroup}>
                            <label style={styles.formLabel}>Açıklama / Notlar</label>
                            <textarea
                                style={{ ...styles.formInput, height: '80px', resize: 'vertical' }}
                                placeholder="Görevin detayları, kullanılacak parçalar vb."
                                value={cardForm.description}
                                onChange={(e) => setCardForm({ ...cardForm, description: e.target.value })}
                            />
                        </div>
                        <div style={styles.formGroup}>
                            <label style={styles.formLabel}>Etiket</label>
                            <input
                                type="text"
                                style={styles.formInput}
                                placeholder="Tasarım, Baskı, Yazılım, Mekanik..."
                                value={cardForm.tag}
                                onChange={(e) => setCardForm({ ...cardForm, tag: e.target.value })}
                            />
                        </div>
                        <div style={styles.formGroup}>
                            <label style={styles.formLabel}>Atanan Üye</label>
                            <select
                                style={styles.formInput}
                                value={cardForm.assigned_user_id}
                                onChange={(e) => setCardForm({ ...cardForm, assigned_user_id: e.target.value })}
                            >
                                <option value="">Atama Yapma</option>
                                {members.map(m => (
                                    <option key={m.user_id} value={m.user_id}>{m.display_name}</option>
                                ))}
                            </select>
                        </div>
                        <div style={styles.modalFooter}>
                            <button type="button" onClick={() => setShowCardModal(false)} style={styles.cancelBtn}>İptal</button>
                            <button type="submit" style={styles.primaryActionButton}>Görevi Ekle</button>
                        </div>
                    </form>
                </ModalWrapper>
            )}
        </div>
    );
}

// ----------------- YARDIMCI BİLEŞEN: MODAL SARMALAYICI -----------------

function ModalWrapper({ title, children, onClose, width = '480px' }) {
    return (
        <div style={styles.modalBackdrop}>
            <div style={{ ...styles.modalBox, maxWidth: width }}>
                <div style={styles.modalHeader}>
                    <h3 style={{ margin: 0, color: '#fff', fontSize: '18px' }}>{title}</h3>
                    <button onClick={onClose} style={styles.modalCloseBtn}>✕</button>
                </div>
                <div style={styles.modalBody}>
                    {children}
                </div>
            </div>
        </div>
    );
}

// ----------------- STİLLER -----------------

const styles = {
    container: {
        display: 'flex',
        height: 'calc(100vh - 75px)',
        backgroundColor: '#0a0a0f',
        color: '#fff',
        overflow: 'hidden',
        position: 'relative'
    },
    toast: {
        position: 'absolute',
        top: '15px',
        right: '20px',
        backgroundColor: '#1e293b',
        border: `1px solid ${PRIMARY_BLUE}`,
        color: '#fff',
        padding: '10px 18px',
        borderRadius: '8px',
        zIndex: 9999,
        fontSize: '13px',
        boxShadow: '0 8px 24px rgba(0, 102, 255, 0.25)'
    },

    // MOBİL SEKME VE BUTON STİLLERİ
    mobileNavTabBar: {
        display: 'flex',
        backgroundColor: '#0c0c14',
        borderBottom: '1px solid #1a1a28',
        width: '100%',
        zIndex: 50
    },
    mobileNavTabBtn: {
        flex: 1,
        backgroundColor: 'transparent',
        border: 'none',
        padding: '12px 6px',
        fontSize: '12px',
        fontWeight: 'bold',
        cursor: 'pointer',
        textAlign: 'center',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis'
    },
    mobileBackBtn: {
        backgroundColor: '#161624',
        border: '1px solid #2f2f45',
        color: PRIMARY_BLUE,
        padding: '4px 8px',
        borderRadius: '6px',
        fontSize: '11px',
        fontWeight: 'bold',
        cursor: 'pointer',
        marginRight: '6px'
    },

    // SAĞ TIK BAĞLAM MENÜSÜ STİLLERİ
    contextMenuContainer: {
        position: 'fixed',
        backgroundColor: '#12121c',
        border: '1px solid #28283c',
        borderRadius: '8px',
        boxShadow: '0 8px 28px rgba(0,0,0,0.7)',
        padding: '6px',
        zIndex: 10000,
        minWidth: '190px',
        display: 'flex',
        flexDirection: 'column',
        gap: '2px'
    },
    contextMenuHeader: {
        fontSize: '11px',
        color: '#71717a',
        padding: '6px 10px 4px 10px',
        fontWeight: 'bold',
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap'
    },
    contextMenuItem: {
        display: 'flex',
        alignItems: 'center',
        backgroundColor: 'transparent',
        border: 'none',
        color: '#e4e4e7',
        padding: '8px 10px',
        borderRadius: '5px',
        fontSize: '13px',
        cursor: 'pointer',
        textAlign: 'left',
        width: '100%',
        transition: 'background 0.15s ease'
    },
    contextMenuDivider: {
        height: '1px',
        backgroundColor: '#222232',
        margin: '4px 0'
    },

    // 1. SÜTUN: OBA ÇUBUĞU (Temiz Başlangıç, Emojisiz)
    obaSidebar: {
        width: '72px',
        backgroundColor: '#09090d',
        borderRight: '1px solid #171720',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '14px 0',
        userSelect: 'none'
    },
    obaList: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '12px',
        width: '100%',
        overflowY: 'auto'
    },
    obaIconWrapper: {
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%'
    },
    activePill: {
        position: 'absolute',
        left: 0,
        width: '4px',
        height: '36px',
        borderRadius: '0 4px 4px 0',
        backgroundColor: PRIMARY_BLUE
    },
    obaIconButton: {
        width: '48px',
        height: '48px',
        border: 'none',
        cursor: 'pointer',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        transition: 'border-radius 0.2s, background-color 0.2s',
        overflow: 'hidden',
        padding: 0
    },
    obaAvatarImg: {
        width: '100%',
        height: '100%',
        objectFit: 'cover'
    },
    obaInitial: {
        fontSize: '18px',
        fontWeight: 'bold',
        color: '#fff'
    },
    addObaButton: {
        width: '48px',
        height: '48px',
        borderRadius: '50%',
        border: '1px dashed #3a3a4d',
        backgroundColor: 'transparent',
        color: '#10b981',
        fontSize: '24px',
        cursor: 'pointer',
        transition: '0.2s',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center'
    },

    // 2. SÜTUN: ÇADIRLAR, MASALAR VE LEVHALAR AĞACI
    channelSidebar: {
        width: '270px',
        backgroundColor: '#0f0f16',
        borderRight: '1px solid #1e1e2c',
        display: 'flex',
        flexDirection: 'column',
        userSelect: 'none'
    },
    obaHeader: {
        padding: '16px',
        borderBottom: '1px solid #1a1a26',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
    },
    miniHeaderAvatar: {
        width: '22px',
        height: '22px',
        borderRadius: '6px',
        objectFit: 'cover'
    },
    obaTitle: {
        fontSize: '15px',
        fontWeight: 'bold',
        color: '#fff',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis'
    },
    headerIconButton: {
        backgroundColor: '#1c1c28',
        border: '1px solid #333',
        color: '#aaa',
        borderRadius: '4px',
        padding: '4px 8px',
        cursor: 'pointer',
        fontSize: '13px'
    },
    inviteHeaderBtn: {
        backgroundColor: 'rgba(0, 102, 255, 0.12)',
        color: '#3b82f6',
        border: '1px solid rgba(0, 102, 255, 0.3)',
        borderRadius: '4px',
        padding: '4px 9px',
        cursor: 'pointer',
        fontSize: '12px',
        fontWeight: '600',
        transition: '0.15s'
    },
    miniInviteBtn: {
        backgroundColor: 'transparent',
        color: '#3b82f6',
        border: 'none',
        fontSize: '11px',
        fontWeight: 'bold',
        cursor: 'pointer',
        padding: '2px 4px'
    },
    collapseMemberBtn: {
        backgroundColor: 'transparent',
        border: 'none',
        color: '#71717a',
        fontSize: '11px',
        cursor: 'pointer',
        padding: '2px 5px',
        borderRadius: '3px',
        transition: '0.15s'
    },
    collapsedMemberBar: {
        width: '28px',
        height: '100%',
        backgroundColor: '#0c0c13',
        borderLeft: '1px solid #1a1a26',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        paddingTop: '16px',
        cursor: 'pointer',
        userSelect: 'none',
        transition: '0.2s',
        zIndex: 5
    },
    collapsedExpandArrow: {
        color: PRIMARY_BLUE,
        fontSize: '12px',
        marginBottom: '14px',
        transition: 'transform 0.2s'
    },
    collapsedVerticalText: {
        writingMode: 'vertical-rl',
        fontSize: '10px',
        fontWeight: 'bold',
        color: '#71717a',
        letterSpacing: '1px',
        transform: 'rotate(180deg)',
        whiteSpace: 'nowrap'
    },
    addJoinChoiceCard: {
        backgroundColor: '#12121a',
        border: '1px solid #222232',
        borderRadius: '8px',
        padding: '14px 16px',
        cursor: 'pointer',
        transition: 'all 0.18s cubic-bezier(0.4, 0, 0.2, 1)'
    },
    choiceCardBadge: {
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        color: '#fff',
        fontSize: '11px',
        fontWeight: 'bold',
        padding: '6px 10px',
        borderRadius: '6px',
        letterSpacing: '0.5px'
    },
    choiceCardTitle: {
        fontSize: '14px',
        fontWeight: 'bold',
        color: '#fff',
        marginBottom: '3px'
    },
    choiceCardDesc: {
        fontSize: '12px',
        color: '#888',
        lineHeight: '1.4'
    },
    choiceCardArrow: {
        fontSize: '16px',
        color: '#666',
        transition: '0.15s'
    },
    joinObaBtn: {
        backgroundColor: PRIMARY_BLUE,
        color: '#fff',
        border: 'none',
        padding: '4px 10px',
        borderRadius: '4px',
        fontSize: '12px',
        fontWeight: 'bold',
        cursor: 'pointer'
    },
    leaveObaBtn: {
        backgroundColor: '#271b1b',
        color: '#ef4444',
        border: '1px solid #4a2121',
        borderRadius: '4px',
        padding: '4px 8px',
        cursor: 'pointer',
        fontSize: '12px'
    },
    treeScrollArea: {
        flex: 1,
        overflowY: 'auto',
        padding: '12px 8px'
    },
    addCadirButton: {
        width: '100%',
        padding: '8px',
        backgroundColor: '#161622',
        border: '1px dashed #2f2f45',
        color: PRIMARY_BLUE,
        borderRadius: '6px',
        fontSize: '12px',
        fontWeight: 'bold',
        cursor: 'pointer',
        marginBottom: '14px'
    },
    cadirContainer: {
        marginBottom: '16px'
    },
    cadirHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '4px 6px',
        borderRadius: '4px'
    },
    cadirTitleArea: {
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        cursor: 'pointer',
        flex: 1,
        overflow: 'hidden'
    },
    cadirArrow: {
        fontSize: '9px',
        color: '#71717a'
    },
    cadirName: {
        fontSize: '12px',
        fontWeight: 'bold',
        color: '#94a3b8',
        textTransform: 'uppercase',
        letterSpacing: '0.5px'
    },
    cadirActionButtons: {
        display: 'flex',
        gap: '4px'
    },
    miniActionButton: {
        backgroundColor: 'transparent',
        border: 'none',
        color: '#888',
        cursor: 'pointer',
        fontSize: '13px',
        padding: '2px 4px'
    },
    miniDeleteButton: {
        backgroundColor: 'transparent',
        border: 'none',
        color: '#ef4444',
        cursor: 'pointer',
        fontSize: '14px',
        padding: '2px 4px'
    },
    masaList: {
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        marginTop: '4px',
        paddingLeft: '10px'
    },
    masaBlock: {
        display: 'flex',
        flexDirection: 'column'
    },
    masaRowHeader: {
        display: 'flex',
        alignItems: 'center',
        padding: '6px 8px',
        borderRadius: '6px',
        cursor: 'pointer',
        fontSize: '13px',
        transition: '0.15s',
        position: 'relative'
    },
    masaArrow: {
        fontSize: '8px',
        color: '#666',
        marginRight: '2px'
    },
    masaNameText: {
        fontWeight: '600',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis'
    },
    masaHoverActions: {
        display: 'flex',
        gap: '2px'
    },
    levhaNestedList: {
        display: 'flex',
        flexDirection: 'column',
        gap: '2px',
        paddingLeft: '18px',
        marginTop: '2px',
        marginBottom: '4px'
    },
    levhaSidebarItem: {
        display: 'flex',
        alignItems: 'center',
        padding: '5px 8px',
        borderRadius: '4px',
        cursor: 'pointer',
        fontSize: '12.5px',
        transition: '0.15s',
        position: 'relative'
    },
    levhaItemTitle: {
        flex: 1,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis'
    },
    levhaQuickActions: {
        display: 'flex',
        gap: '2px'
    },
    miniAddLevhaBtn: {
        backgroundColor: 'transparent',
        border: '1px dashed #272738',
        color: '#666',
        borderRadius: '4px',
        padding: '4px',
        fontSize: '11px',
        cursor: 'pointer',
        textAlign: 'left',
        marginTop: '2px'
    },
    userProfileFooter: {
        padding: '12px',
        backgroundColor: '#0b0b11',
        borderTop: '1px solid #1a1a26',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
    },
    userAvatar: {
        width: '32px',
        height: '32px',
        borderRadius: '50%',
        objectFit: 'cover'
    },
    userAvatarPlaceholder: {
        width: '32px',
        height: '32px',
        borderRadius: '50%',
        backgroundColor: '#272738',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center'
    },
    userName: {
        fontSize: '13px',
        fontWeight: 'bold',
        color: '#fff'
    },
    userRoleBadge: {
        fontSize: '11px',
        marginTop: '1px'
    },
    memberToggleBtn: {
        backgroundColor: 'transparent',
        border: 'none',
        fontSize: '16px',
        cursor: 'pointer',
        padding: '4px'
    },

    // 3. SÜTUN: MERKEZ ÇALIŞMA ALANI
    mainWorkspace: {
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#0c0c12',
        overflow: 'hidden'
    },
    levhaHeaderBar: {
        height: '52px',
        backgroundColor: '#0f0f17',
        borderBottom: '1px solid #1a1a28',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '0 20px'
    },
    levhaHeaderLeft: {
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        overflow: 'hidden'
    },
    levhaActiveTitleText: {
        margin: 0,
        fontSize: '16px',
        fontWeight: 'bold',
        color: '#fff',
        whiteSpace: 'nowrap'
    },
    levhaTypeBadge: {
        backgroundColor: 'rgba(0, 102, 255, 0.15)',
        color: PRIMARY_BLUE,
        fontSize: '11px',
        fontWeight: 'bold',
        padding: '3px 8px',
        borderRadius: '6px'
    },
    levhaSettingsBtn: {
        backgroundColor: '#161622',
        border: '1px solid #2f2f45',
        color: '#94a3b8',
        padding: '5px 10px',
        borderRadius: '6px',
        fontSize: '12px',
        cursor: 'pointer'
    },
    levhaDeleteBtn: {
        backgroundColor: 'transparent',
        border: 'none',
        color: '#ef4444',
        padding: '5px 8px',
        cursor: 'pointer',
        fontSize: '14px'
    },
    levhaContentArea: {
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
    },
    emptyCenterNotice: {
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        textAlign: 'center',
        padding: '30px'
    },
    emptyNotice: {
        color: '#666',
        fontSize: '12px',
        textAlign: 'center',
        padding: '20px'
    },

    // 4. SÜTUN: ÜYE LİSTESİ
    memberSidebar: {
        width: '220px',
        backgroundColor: '#09090e',
        borderLeft: '1px solid #1a1a26',
        display: 'flex',
        flexDirection: 'column',
        userSelect: 'none'
    },
    memberSidebarHeader: {
        padding: '14px 16px',
        borderBottom: '1px solid #161622',
        fontSize: '11px',
        fontWeight: 'bold',
        color: '#71717a',
        letterSpacing: '0.5px'
    },
    memberListScroll: {
        flex: 1,
        overflowY: 'auto',
        padding: '8px'
    },
    memberRow: {
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '6px 8px',
        borderRadius: '6px',
        marginBottom: '2px',
        transition: '0.15s'
    },
    memberAvatar: {
        width: '30px',
        height: '30px',
        borderRadius: '50%',
        objectFit: 'cover'
    },
    memberAvatarPlaceholder: {
        width: '30px',
        height: '30px',
        borderRadius: '50%',
        backgroundColor: '#1f1f2e',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center'
    },
    memberName: {
        fontSize: '13px',
        fontWeight: '500',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis'
    },
    memberRoleTags: {
        display: 'flex',
        gap: '4px',
        flexWrap: 'wrap',
        marginTop: '2px'
    },
    roleMiniTag: {
        fontSize: '9px',
        border: '1px solid',
        borderRadius: '4px',
        padding: '1px 4px',
        fontWeight: 'bold'
    },
    defaultRoleTag: {
        fontSize: '10px',
        color: '#666'
    },

    // CHAT LEVHASI STİLLERİ
    chatContainer: {
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
    },
    chatMessagesArea: {
        flex: 1,
        overflowY: 'auto',
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '14px'
    },
    chatEmptyMessage: {
        color: '#71717a',
        textAlign: 'center',
        marginTop: '40px',
        fontSize: '14px'
    },
    chatMessageRow: {
        display: 'flex',
        gap: '12px',
        position: 'relative'
    },
    chatAvatar: {
        width: '36px',
        height: '36px',
        borderRadius: '50%',
        objectFit: 'cover',
        marginTop: '2px'
    },
    chatAvatarPlaceholder: {
        width: '36px',
        height: '36px',
        borderRadius: '50%',
        backgroundColor: '#1f1f2e',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: '2px'
    },
    chatTimestamp: {
        fontSize: '11px',
        color: '#666',
        marginLeft: '4px'
    },
    chatContentText: {
        fontSize: '14px',
        color: '#e2e8f0',
        marginTop: '4px',
        lineHeight: '1.5',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word'
    },
    chatDeleteBtn: {
        backgroundColor: 'transparent',
        border: 'none',
        color: '#ef4444',
        fontSize: '16px',
        cursor: 'pointer',
        opacity: 0.7
    },
    chatInputBar: {
        padding: '14px 20px',
        backgroundColor: '#0d0d14',
        borderTop: '1px solid #1c1c28',
        display: 'flex',
        gap: '10px'
    },
    chatInput: {
        flex: 1,
        backgroundColor: '#161622',
        border: '1px solid #28283d',
        borderRadius: '8px',
        padding: '10px 14px',
        color: '#fff',
        fontSize: '14px',
        outline: 'none'
    },
    chatSendBtn: {
        backgroundColor: PRIMARY_BLUE,
        color: '#fff',
        border: 'none',
        borderRadius: '8px',
        padding: '0 20px',
        fontWeight: 'bold',
        cursor: 'pointer'
    },

    // DUYURU LEVHASI STİLLERİ
    announcementContainer: {
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        padding: '24px'
    },
    announcementHeaderBar: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '20px'
    },
    announcementList: {
        flex: 1,
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '14px'
    },
    announcementCard: {
        backgroundColor: '#12121c',
        borderRadius: '8px',
        padding: '18px',
        border: '1px solid #1f1f2e'
    },
    annTitle: {
        margin: 0,
        fontSize: '16px',
        color: '#fff'
    },
    annContent: {
        color: '#ccc',
        fontSize: '14px',
        lineHeight: '1.6',
        margin: '10px 0',
        whiteSpace: 'pre-wrap'
    },
    annFooter: {
        display: 'flex',
        justifyContent: 'space-between',
        fontSize: '12px',
        color: '#71717a',
        borderTop: '1px solid #1a1a26',
        paddingTop: '8px',
        marginTop: '10px'
    },

    // TABLO LEVHASI STİLLERİ
    tableContainer: {
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        padding: '20px'
    },
    tableToolbar: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '16px'
    },
    tableScrollWrapper: {
        flex: 1,
        overflow: 'auto',
        backgroundColor: '#101018',
        borderRadius: '8px',
        border: '1px solid #1f1f2e'
    },
    excelTable: {
        width: '100%',
        borderCollapse: 'collapse',
        textAlign: 'left',
        fontSize: '13px'
    },
    tableHeaderCellIndex: {
        width: '40px',
        padding: '10px',
        backgroundColor: '#161624',
        borderBottom: '2px solid #252538',
        color: '#71717a',
        textAlign: 'center'
    },
    tableHeaderCell: {
        padding: '10px 14px',
        backgroundColor: '#161624',
        borderBottom: '2px solid #252538',
        color: '#94a3b8',
        fontWeight: 'bold'
    },
    tableHeaderCellAction: {
        width: '60px',
        padding: '10px',
        backgroundColor: '#161624',
        borderBottom: '2px solid #252538',
        textAlign: 'center'
    },
    tableRow: {
        borderBottom: '1px solid #1a1a28'
    },
    tableNewRow: {
        backgroundColor: '#13131e',
        borderBottom: '1px solid #252538'
    },
    tableCellIndex: {
        padding: '8px',
        color: '#666',
        textAlign: 'center',
        fontSize: '12px'
    },
    tableCell: {
        padding: '4px 6px',
        borderRight: '1px solid #1a1a28'
    },
    cellInput: {
        width: '100%',
        backgroundColor: 'transparent',
        border: 'none',
        color: '#fff',
        padding: '6px 8px',
        fontSize: '13px',
        outline: 'none'
    },
    cellNewInput: {
        width: '100%',
        backgroundColor: '#1b1b2a',
        border: '1px solid #2e2e46',
        borderRadius: '4px',
        color: '#fff',
        padding: '6px 8px',
        fontSize: '12px',
        outline: 'none'
    },
    tableCellAction: {
        textAlign: 'center',
        padding: '6px'
    },
    miniAddBtn: {
        backgroundColor: PRIMARY_BLUE,
        color: '#fff',
        border: 'none',
        padding: '4px 10px',
        borderRadius: '4px',
        fontSize: '11px',
        fontWeight: 'bold',
        cursor: 'pointer'
    },

    // KANBAN LEVHASI STİLLERİ
    kanbanContainer: {
        flex: 1,
        overflowX: 'auto',
        overflowY: 'hidden',
        padding: '20px'
    },
    kanbanColumnsWrapper: {
        display: 'flex',
        gap: '16px',
        height: '100%',
        alignItems: 'flex-start'
    },
    kanbanColumn: {
        width: '280px',
        maxHeight: '100%',
        backgroundColor: '#101018',
        borderRadius: '10px',
        border: '1px solid #1c1c28',
        display: 'flex',
        flexDirection: 'column'
    },
    kanbanColumnHeader: {
        padding: '12px 14px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottom: '1px solid #191924'
    },
    colBadge: {
        backgroundColor: '#1e1e2d',
        color: PRIMARY_BLUE,
        fontSize: '11px',
        fontWeight: 'bold',
        padding: '2px 7px',
        borderRadius: '10px'
    },
    colAddBtn: {
        backgroundColor: 'transparent',
        border: 'none',
        color: '#94a3b8',
        fontSize: '18px',
        cursor: 'pointer'
    },
    kanbanCardList: {
        flex: 1,
        overflowY: 'auto',
        padding: '10px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px'
    },
    kanbanCard: {
        backgroundColor: '#161622',
        borderRadius: '8px',
        padding: '12px',
        border: '1px solid #232336',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px'
    },
    cardTag: {
        fontSize: '10px',
        backgroundColor: 'rgba(0, 102, 255, 0.15)',
        color: PRIMARY_BLUE,
        padding: '2px 6px',
        borderRadius: '4px',
        fontWeight: 'bold'
    },
    cardTitle: {
        fontSize: '14px',
        fontWeight: 'bold',
        color: '#fff',
        lineHeight: '1.4'
    },
    cardDescription: {
        fontSize: '12px',
        color: '#94a3b8',
        lineHeight: '1.5'
    },
    cardFooter: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: '6px',
        paddingTop: '6px',
        borderTop: '1px solid #1d1d2c'
    },
    cardAssignee: {
        fontSize: '11px',
        color: '#666'
    },
    moveBtn: {
        backgroundColor: '#202030',
        border: 'none',
        color: '#aaa',
        borderRadius: '4px',
        padding: '3px 6px',
        fontSize: '10px',
        cursor: 'pointer'
    },
    addCardUnderColumnBtn: {
        backgroundColor: 'transparent',
        border: '1px dashed #28283d',
        color: '#888',
        borderRadius: '6px',
        padding: '8px',
        fontSize: '12px',
        cursor: 'pointer',
        marginTop: '4px'
    },

    // SUNUCU AYARLARI STİLLERİ
    settingsTabBar: {
        display: 'flex',
        gap: '12px',
        borderBottom: '1px solid #1f1f2e',
        paddingBottom: '2px'
    },
    settingsTabBtn: {
        backgroundColor: 'transparent',
        border: 'none',
        padding: '10px 16px',
        fontSize: '13px',
        fontWeight: 'bold',
        cursor: 'pointer',
        transition: '0.2s'
    },
    avatarPreviewContainer: {
        width: '64px',
        height: '64px',
        borderRadius: '16px',
        backgroundColor: '#1a1a28',
        border: '1px solid #2f2f45',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden'
    },
    avatarPreviewImg: {
        width: '100%',
        height: '100%',
        objectFit: 'cover'
    },
    presetAvatarBtn: {
        backgroundColor: '#191926',
        border: '1px solid #2b2b3d',
        color: '#ccc',
        padding: '4px 8px',
        borderRadius: '4px',
        fontSize: '11px',
        cursor: 'pointer'
    },
    dangerZoneBox: {
        backgroundColor: 'rgba(239, 68, 68, 0.06)',
        border: '1px solid rgba(239, 68, 68, 0.3)',
        borderRadius: '8px',
        padding: '18px'
    },
    dangerDeleteBtn: {
        backgroundColor: '#ef4444',
        color: '#fff',
        border: 'none',
        padding: '10px 20px',
        borderRadius: '6px',
        fontWeight: 'bold',
        fontSize: '13px',
        cursor: 'pointer'
    },

    // MODAL ORTAK STİLLERİ
    modalBackdrop: {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(3px)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10000,
        padding: '20px'
    },
    modalBox: {
        width: '100%',
        backgroundColor: '#111119',
        border: `1px solid ${PRIMARY_BLUE}`,
        borderRadius: '12px',
        overflow: 'hidden',
        boxShadow: '0 20px 40px rgba(0, 0, 0, 0.8)'
    },
    modalHeader: {
        padding: '16px 20px',
        borderBottom: '1px solid #1f1f2e',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#0d0d14'
    },
    modalCloseBtn: {
        backgroundColor: 'transparent',
        border: 'none',
        color: '#888',
        fontSize: '16px',
        cursor: 'pointer'
    },
    modalBody: {
        padding: '20px'
    },
    formGroup: {
        marginBottom: '16px'
    },
    formLabel: {
        display: 'block',
        fontSize: '12px',
        fontWeight: 'bold',
        color: '#94a3b8',
        marginBottom: '6px'
    },
    formInput: {
        width: '100%',
        backgroundColor: '#161622',
        border: '1px solid #29293e',
        borderRadius: '6px',
        padding: '9px 12px',
        color: '#fff',
        fontSize: '13px',
        outline: 'none',
        boxSizing: 'border-box'
    },
    modalFooter: {
        display: 'flex',
        justifyContent: 'flex-end',
        gap: '10px',
        marginTop: '20px',
        paddingTop: '16px',
        borderTop: '1px solid #1a1a26'
    },
    primaryActionButton: {
        backgroundColor: PRIMARY_BLUE,
        color: '#fff',
        border: 'none',
        padding: '9px 18px',
        borderRadius: '6px',
        fontWeight: 'bold',
        fontSize: '13px',
        cursor: 'pointer',
        transition: '0.2s'
    },
    secondaryBtn: {
        backgroundColor: '#1c1c28',
        color: '#ccc',
        border: '1px solid #333',
        padding: '7px 14px',
        borderRadius: '6px',
        fontSize: '12px',
        cursor: 'pointer'
    },
    cancelBtn: {
        backgroundColor: 'transparent',
        color: '#888',
        border: 'none',
        padding: '9px 14px',
        cursor: 'pointer',
        fontSize: '13px'
    },
    iconSelectBtn: {
        backgroundColor: '#161622',
        borderRadius: '6px',
        padding: '8px 12px',
        fontSize: '18px',
        cursor: 'pointer'
    },
    levhaTypeGrid: {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '10px'
    },
    levhaTypeCard: {
        border: '1px solid',
        borderRadius: '8px',
        padding: '12px',
        cursor: 'pointer',
        transition: '0.2s'
    },
    roleItemRow: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '8px 10px',
        borderRadius: '6px',
        backgroundColor: '#161622',
        marginBottom: '6px'
    },
    vDividerHorizontal: {
        height: '1px',
        backgroundColor: '#1f1f2e',
        margin: '16px 0'
    },
    permRoleBlock: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '10px 12px',
        backgroundColor: '#161622',
        borderRadius: '8px'
    },
    permButtonToggleGroup: {
        display: 'flex',
        alignItems: 'center',
        gap: '4px'
    },
    toggleBtn: {
        width: '26px',
        height: '26px',
        borderRadius: '4px',
        border: 'none',
        cursor: 'pointer',
        fontWeight: 'bold',
        fontSize: '12px',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center'
    }
};
