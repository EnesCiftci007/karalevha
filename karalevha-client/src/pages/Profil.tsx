import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { api, API_URL } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { User, Users, MapPin, Link as LinkIcon, Calendar, Edit2, Code2, AlertTriangle, Loader2, Save, X } from 'lucide-react';
import { Project } from '../types';

interface ProfileData {
  id: number;
  username: string;
  bio: string | null;
  avatarSeed: string;
  createdAt: string;
  followerCount: number;
  followingCount: number;
  isFollowing: boolean;
  projects: Project[];
}

export default function Profil() {
  const { username } = useParams();
  const { user, token } = useAuth();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [isEditing, setIsEditing] = useState(false);
  const [editBio, setEditBio] = useState('');
  const [saving, setSaving] = useState(false);

  const isOwnProfile = user?.username.toLowerCase() === username?.toLowerCase();

  useEffect(() => {
    fetchProfile();
  }, [username]);

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const headers: any = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      
      const res = await fetch(`${API_URL}/api/users/${username}`, { headers });
      if (!res.ok) throw new Error('Profil bulunamadı');
      
      const data = await res.json();
      setProfile(data);
      setEditBio(data.bio || '');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFollow = async () => {
    if (!profile) return;
    try {
      const endpoint = profile.isFollowing ? 'unfollow' : 'follow';
      const res = await fetch(`${API_URL}/api/users/${username}/${endpoint}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (res.ok) {
        setProfile(prev => prev ? {
          ...prev,
          isFollowing: !prev.isFollowing,
          followerCount: prev.isFollowing ? prev.followerCount - 1 : prev.followerCount + 1
        } : null);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const saveProfile = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/api/users/me`, {
        method: 'PUT',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ bio: editBio })
      });
      if (res.ok) {
        const data = await res.json();
        setProfile(prev => prev ? { ...prev, bio: data.bio } : null);
        setIsEditing(false);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
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

      <div className="px-6 relative -mt-16 mb-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between">
          <div className="flex flex-col md:flex-row md:items-end space-y-4 md:space-y-0 md:space-x-6">
            <img 
              src={avatarUrl} 
              alt={profile.username}
              className="w-32 h-32 rounded-full border-4 border-[#0b0c10] bg-[#111216]"
            />
            <div className="pb-2">
              <h1 className="text-3xl font-black uppercase tracking-widest text-white">{profile.username}</h1>
              <div className="flex items-center space-x-4 mt-2 text-zinc-400 text-sm font-bold uppercase tracking-wide">
                <span className="flex items-center"><Users className="w-4 h-4 mr-1" /> {profile.followerCount} Takipçi</span>
                <span className="flex items-center">{profile.followingCount} Takip</span>
                <span className="flex items-center"><Calendar className="w-4 h-4 mr-1" /> {new Date(profile.createdAt).getFullYear()}</span>
              </div>
            </div>
          </div>
          
          <div className="mt-4 md:mt-0 pb-2">
            {isOwnProfile ? (
              <button 
                onClick={() => setIsEditing(!isEditing)}
                className="px-6 py-2 border-2 border-zinc-700 text-zinc-300 font-bold uppercase tracking-widest hover:border-white hover:text-white transition-colors flex items-center"
              >
                {isEditing ? <X className="w-4 h-4 mr-2" /> : <Edit2 className="w-4 h-4 mr-2" />}
                {isEditing ? 'İptal' : 'Profili Düzenle'}
              </button>
            ) : token ? (
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
            ) : null}
          </div>
        </div>
      </div>

      <div className="px-6 grid grid-cols-1 md:grid-cols-3 gap-8">
        
        {/* Left Column - Info */}
        <div className="space-y-6">
          <div className="bg-[#111216] border-2 border-[#1f2129] p-5">
            <h3 className="text-sm font-bold text-zinc-500 uppercase tracking-widest mb-4">Hakkında</h3>
            
            {isEditing ? (
              <div className="space-y-3">
                <textarea 
                  value={editBio}
                  onChange={(e) => setEditBio(e.target.value)}
                  placeholder="Kendinden bahset..."
                  className="w-full bg-[#0b0c10] border-2 border-zinc-800 p-3 text-zinc-300 focus:border-[#00e5ff] focus:outline-none min-h-[100px] resize-none"
                  maxLength={255}
                />
                <button 
                  onClick={saveProfile}
                  disabled={saving}
                  className="w-full bg-[#00e5ff] text-black font-black uppercase tracking-widest py-2 hover:bg-white transition-colors flex justify-center items-center"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4 mr-2" /> Kaydet</>}
                </button>
              </div>
            ) : (
              <p className="text-zinc-300 text-sm leading-relaxed">
                {profile.bio || <span className="text-zinc-600 italic">Biyografi eklenmemiş.</span>}
              </p>
            )}
          </div>
        </div>

        {/* Right Column - Projects */}
        <div className="md:col-span-2 space-y-6">
          <h3 className="text-xl font-black uppercase tracking-widest text-white border-b-2 border-[#1f2129] pb-3 flex items-center">
            <Code2 className="w-6 h-6 mr-2 text-[#00e5ff]" />
            Projeler ({profile.projects.length})
          </h3>

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
                  <a 
                    href={`/projeler/${proj.id}`}
                    className="inline-block px-4 py-1.5 border-2 border-zinc-700 text-zinc-300 text-xs font-bold uppercase tracking-widest hover:border-[#00e5ff] hover:text-[#00e5ff] transition-colors"
                  >
                    İncele
                  </a>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

    </div>
  );
}
