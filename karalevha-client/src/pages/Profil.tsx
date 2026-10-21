import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Users, Calendar, Edit2, Code2, AlertTriangle, Loader2, Save, X, Box, Plus, Shield, Ban } from 'lucide-react';
import { Project, PrintModel } from '../types';

interface ProfileData {
  id: number;
  username: string;
  bio: string | null;
  interests?: string[];
  avatarSeed: string;
  role?: 'Owner' | 'Admin' | 'User';
  bannedUntil?: string | null;
  createdAt: string;
  followerCount: number;
  followingCount: number;
  isFollowing: boolean;
  projects: Project[];
  printModels?: PrintModel[];
}

export default function Profil() {
  const { username } = useParams();
  const { user, token } = useAuth();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [isEditing, setIsEditing] = useState(false);
  const [editBio, setEditBio] = useState('');
  const [editInterests, setEditInterests] = useState<string[]>([]);
  const AVAILABLE_INTERESTS = ['Yazılım', 'Robotik', '3B Baskı', 'Elektronik', 'El İşi', 'Tasarım', 'Oyun Geliştirme', 'IoT'];
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'projects' | 'models'>('projects');

  const isOwnProfile = user?.username.toLowerCase() === username?.toLowerCase();

  useEffect(() => {
    fetchProfile();
  }, [username]);

  const fetchProfile = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api<ProfileData>(`/api/users/${username}`);
      setProfile(data);
      setEditBio(data.bio || '');
      setEditInterests(data.interests || []);
    } catch (err: any) {
      setError(err.message || 'Profil bulunamadı');
    } finally {
      setLoading(false);
    }
  };

  const handleFollow = async () => {
    if (!profile) return;
    try {
      const endpoint = profile.isFollowing ? 'unfollow' : 'follow';
      await api(`/api/users/${username}/${endpoint}`, {
        method: 'POST'
      });
      setProfile(prev => prev ? {
        ...prev,
        isFollowing: !prev.isFollowing,
        followerCount: prev.isFollowing ? prev.followerCount - 1 : prev.followerCount + 1
      } : null);
    } catch (err) {
      console.error(err);
    }
  };

  const toggleInterest = (interest: string) => {
    setEditInterests(prev => prev.includes(interest) ? prev.filter(i => i !== interest) : [...prev, interest]);
  };

  const saveProfile = async () => {
    setSaving(true);
    try {
      const data = await api<{ bio: string | null; interests: string[] }>('/api/users/me', {
        method: 'PUT',
        body: JSON.stringify({ bio: editBio, interests: editInterests })
      });
      setProfile(prev => prev ? { ...prev, bio: data.bio, interests: data.interests } : null);
      setIsEditing(false);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleSetRole = async (newRole: 'Admin' | 'User') => {
    if (!profile) return;
    try {
      await api('/api/admin/set-role', {
        method: 'POST',
        body: JSON.stringify({ userId: profile.id, role: newRole })
      });
      setProfile(prev => prev ? { ...prev, role: newRole } : null);
    } catch (err: any) {
      alert(err.message || 'Rol güncellenemedi.');
    }
  };

  const handleToggleBan = async () => {
    if (!profile) return;
    try {
      if (profile.bannedUntil) {
        await api('/api/admin/unban-user', {
          method: 'POST',
          body: JSON.stringify({ userId: profile.id })
        });
        setProfile(prev => prev ? { ...prev, bannedUntil: null } : null);
      } else {
        const input = window.prompt('Kaç saat banlamak istiyorsunuz? (1 - 8760)', '24');
        if (!input) return;
        const durationHours = parseInt(input, 10);
        if (isNaN(durationHours) || durationHours < 1) return;
        const res = await api<{ bannedUntil: string }>('/api/admin/ban-user', {
          method: 'POST',
          body: JSON.stringify({ userId: profile.id, durationHours })
        });
        setProfile(prev => prev ? { ...prev, bannedUntil: res.bannedUntil } : null);
      }
    } catch (err: any) {
      alert(err.message || 'İşlem başarısız.');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20 text-[#00e5ff]">
        <Loader2 className="w-12 h-12 animate-spin" />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-red-500">
        <AlertTriangle className="w-12 h-12 mb-4" />
        <h2 className="text-xl font-bold uppercase tracking-widest">{error}</h2>
      </div>
    );
  }

  const avatarUrl = profile.avatarSeed 
    ? `https://api.dicebear.com/7.x/bottts/svg?seed=${profile.avatarSeed}` 
    : `https://api.dicebear.com/7.x/bottts/svg?seed=${profile.username}`;

  return (
    <div className="max-w-4xl mx-auto animate-in fade-in duration-300 pb-20">
      
      {/* Cover Image Placeholder */}
      <div className="h-48 bg-[#1f2129] border-2 border-[#1f2129] w-full relative">
        <div className="absolute inset-0 bg-gradient-to-t from-[#0b0c10] to-transparent opacity-80" />
      </div>

      <div className="px-6 md:px-8 relative -mt-16 mb-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between">
          <div className="flex flex-col md:flex-row md:items-end space-y-4 md:space-y-0 md:space-x-6">
            <img 
              src={avatarUrl} 
              alt={profile.username}
              className="w-32 h-32 rounded-full border-4 border-[#0b0c10] bg-[#111216]"
            />
            <div className="pb-2">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-3xl font-black uppercase tracking-widest text-white">{profile.username}</h1>
                {profile.role && profile.role !== 'User' && (
                  <span className="px-2 py-0.5 text-xs font-black uppercase tracking-widest border border-[#00e5ff] text-[#00e5ff] bg-[#00e5ff]/10">
                    {profile.role}
                  </span>
                )}
                {profile.bannedUntil && (
                  <span className="px-2 py-0.5 text-xs font-black uppercase tracking-widest border border-red-500 text-red-500 bg-red-500/10">
                    YASAKLI
                  </span>
                )}
              </div>
              <div className="flex items-center space-x-4 mt-2 text-zinc-400 text-sm font-bold uppercase tracking-wide">
                <span className="flex items-center"><Users className="w-4 h-4 mr-1" /> {profile.followerCount} Takipçi</span>
                <span className="flex items-center">{profile.followingCount} Takip</span>
                <span className="flex items-center"><Calendar className="w-4 h-4 mr-1" /> {new Date(profile.createdAt).getFullYear()}</span>
              </div>
            </div>
          </div>
          
          <div className="mt-4 md:mt-0 pb-2 flex flex-wrap gap-2">
            {isOwnProfile ? (
              <button 
                onClick={() => setIsEditing(!isEditing)}
                className="px-6 py-2 border-2 border-zinc-700 text-zinc-300 font-bold uppercase tracking-widest hover:border-white hover:text-white transition-colors flex items-center"
              >
                {isEditing ? <X className="w-4 h-4 mr-2" /> : <Edit2 className="w-4 h-4 mr-2" />}
                {isEditing ? 'İptal' : 'Profili Düzenle'}
              </button>
            ) : token ? (
              <>
                <button
                  onClick={handleFollow}
                  className={`px-6 py-2 border-2 font-bold uppercase tracking-widest transition-colors flex items-center ${
                    profile.isFollowing
                      ? 'border-zinc-700 text-zinc-300 hover:border-red-500 hover:text-red-500'
                      : 'border-[#00e5ff] text-[#00e5ff] hover:bg-[#00e5ff] hover:text-black'
                  }`}
                >
                  {profile.isFollowing ? 'Takibi Bırak' : 'Takip Et'}
                </button>
                {user?.role === 'Owner' && profile.role !== 'Owner' && (
                  <button
                    onClick={() => handleSetRole(profile.role === 'Admin' ? 'User' : 'Admin')}
                    className="px-4 py-2 border-2 border-amber-500 text-amber-500 font-bold uppercase tracking-widest hover:bg-amber-500 hover:text-black transition-colors flex items-center text-xs"
                  >
                    <Shield className="w-4 h-4 mr-1" />
                    {profile.role === 'Admin' ? 'Adminliği Al' : 'Admin Yap'}
                  </button>
                )}
                {(user?.role === 'Owner' || (user?.role === 'Admin' && profile.role === 'User')) && profile.role !== 'Owner' && (
                  <button
                    onClick={handleToggleBan}
                    className="px-4 py-2 border-2 border-red-500 text-red-500 font-bold uppercase tracking-widest hover:bg-red-500 hover:text-white transition-colors flex items-center text-xs"
                  >
                    <Ban className="w-4 h-4 mr-1" />
                    {profile.bannedUntil ? 'Banı Kaldır' : 'Banla'}
                  </button>
                )}
              </>
            ) : null}
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="px-6 mb-6 border-b-2 border-[#1f2129]">
        <div className="flex space-x-8">
          <button 
            onClick={() => setActiveTab('projects')}
            className={`pb-3 text-sm font-black uppercase tracking-widest transition-colors ${activeTab === 'projects' ? 'text-[#00e5ff] border-b-2 border-[#00e5ff]' : 'text-zinc-500 hover:text-white'}`}
          >
            Projeler ({profile.projects.length})
          </button>
          <button 
            onClick={() => setActiveTab('models')}
            className={`pb-3 text-sm font-black uppercase tracking-widest transition-colors ${activeTab === 'models' ? 'text-[#a855f7] border-b-2 border-[#a855f7]' : 'text-zinc-500 hover:text-white'}`}
          >
            3B Modeller ({profile.printModels?.length || 0})
          </button>
        </div>
      </div>

      <div className="px-6 grid grid-cols-1 md:grid-cols-3 gap-8">
        
        {/* Left Column - Info */}
        <div className="space-y-6">
          <div className="bg-[#111216] border-2 border-[#1f2129] p-5">
            <h3 className="text-sm font-bold text-zinc-500 uppercase tracking-widest mb-4">Hakkında</h3>
            
            {isEditing ? (
              <div className="space-y-4">
                <textarea 
                  value={editBio}
                  onChange={(e) => setEditBio(e.target.value)}
                  placeholder="Biyografi ekle..."
                  className="w-full bg-[#0b0c10] border-2 border-zinc-800 p-3 text-zinc-300 focus:border-[#00e5ff] focus:outline-none min-h-[100px] resize-none"
                  maxLength={255}
                />
                <div>
                  <span className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2">İlgi Alanları</span>
                  <div className="flex flex-wrap gap-2">
                    {AVAILABLE_INTERESTS.map(interest => {
                      const selected = editInterests.includes(interest);
                      return (
                        <button
                          key={interest}
                          type="button"
                          onClick={() => toggleInterest(interest)}
                          className={`px-2.5 py-1 text-xs font-bold uppercase tracking-wider border transition-colors ${
                            selected
                              ? 'border-[#00e5ff] bg-[#00e5ff]/20 text-[#00e5ff]'
                              : 'border-zinc-700 text-zinc-400 hover:border-zinc-500'
                          }`}
                        >
                          {interest}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <button 
                  onClick={saveProfile}
                  disabled={saving}
                  className="w-full bg-[#00e5ff] text-black font-black uppercase tracking-widest py-2 hover:bg-white transition-colors flex justify-center items-center"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4 mr-2" /> Kaydet</>}
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-zinc-300 text-sm leading-relaxed">
                  {profile.bio || <span className="text-zinc-600 italic">Biyografi eklenmemiş.</span>}
                </p>
                {profile.interests && profile.interests.length > 0 && (
                  <div className="pt-3 border-t border-[#1f2129]">
                    <span className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2">İlgi Alanları</span>
                    <div className="flex flex-wrap gap-2">
                      {profile.interests.map(interest => (
                        <span
                          key={interest}
                          className="px-2.5 py-1 text-xs font-bold uppercase tracking-wider border border-[#00e5ff]/40 bg-[#00e5ff]/10 text-[#00e5ff]"
                        >
                          {interest}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Column - Content */}
        <div className="md:col-span-2 space-y-6">
          {activeTab === 'projects' && (
            <>
              <div className="flex items-center justify-between border-b-2 border-[#1f2129] pb-3">
                <h3 className="text-xl font-black uppercase tracking-widest text-white flex items-center">
                  <Code2 className="w-6 h-6 mr-2 text-[#00e5ff]" />
                  Açık Kaynak
                </h3>
                {isOwnProfile && (
                  <Link to="/projeler?new=true" className="px-4 py-2 bg-[#00e5ff]/10 text-[#00e5ff] font-bold uppercase tracking-widest text-xs hover:bg-[#00e5ff] hover:text-black transition-colors flex items-center">
                    <Plus className="w-4 h-4 mr-1" />
                    Yeni Proje
                  </Link>
                )}
              </div>

              <div className="space-y-4">
                {profile.projects.length === 0 ? (
                  <div className="bg-[#111216] border-2 border-dashed border-[#1f2129] p-8 text-center text-zinc-500">
                    Bu kullanıcı henüz proje paylaşmamış.
                  </div>
                ) : (
                  profile.projects.map(proj => (
                    <div key={proj.id} className="bg-[#111216] border-2 border-[#1f2129] p-5 hover:border-[#00e5ff]/50 transition-colors">
                      <h4 className="text-lg font-bold text-white uppercase tracking-wider mb-2">{proj.title}</h4>
                      <p className="text-zinc-400 text-sm mb-4 line-clamp-2">{proj.description}</p>
                      <Link
                        to={`/projeler/${proj.id}`}
                        className="inline-block px-4 py-1.5 border-2 border-zinc-700 text-zinc-300 text-xs font-bold uppercase tracking-widest hover:border-[#00e5ff] hover:text-[#00e5ff] transition-colors"
                      >
                        İncele
                      </Link>
                    </div>
                  ))
                )}
              </div>
            </>
          )}

          {activeTab === 'models' && (
            <>
              <div className="flex items-center justify-between border-b-2 border-[#1f2129] pb-3">
                <h3 className="text-xl font-black uppercase tracking-widest text-white flex items-center">
                  <Box className="w-6 h-6 mr-2 text-[#a855f7]" />
                  3B Modeller
                </h3>
                {isOwnProfile && (
                  <Link to="/baski-istasyonu" className="px-4 py-2 bg-[#a855f7]/10 text-[#a855f7] font-bold uppercase tracking-widest text-xs hover:bg-[#a855f7] hover:text-white transition-colors flex items-center">
                    <Plus className="w-4 h-4 mr-1" />
                    Model Yükle
                  </Link>
                )}
              </div>

              <div className="space-y-4">
                {!profile.printModels || profile.printModels.length === 0 ? (
                  <div className="bg-[#111216] border-2 border-dashed border-[#1f2129] p-8 text-center text-zinc-500">
                    Bu kullanıcı henüz model yüklememiş.
                  </div>
                ) : (
                  profile.printModels.map((model) => (
                    <div key={model.id} className="bg-[#111216] border-2 border-[#1f2129] p-5 hover:border-[#a855f7]/50 transition-colors">
                      <h4 className="text-lg font-bold text-white uppercase tracking-wider mb-2">{model.title}</h4>
                      <p className="text-zinc-400 text-sm mb-4 line-clamp-2">{model.description}</p>
                      <Link
                        to="/baski-istasyonu"
                        className="inline-block px-4 py-1.5 border-2 border-zinc-700 text-zinc-300 text-xs font-bold uppercase tracking-widest hover:border-[#a855f7] hover:text-[#a855f7] transition-colors"
                      >
                        Tümünü Gör
                      </Link>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>

      </div>

    </div>
  );
}


