import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import { User } from '../types';
import { API_URL, api, apiFetch } from '../services/api';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  /** Giriş yanıtındaki kullanıcı; oturum jetonu sunucunun koyduğu HttpOnly çerezdedir */
  login: (userData: User) => void;
  logout: () => void;
  /** Rol ve askı durumunu sunucudan tazeler */
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth, AuthProvider içinde kullanılmalı.');
  return ctx;
};

/** Eski sürüm jetonu localStorage'da tutuyordu; varsa bir kez çereze taşınır ve silinir */
const LEGACY_TOKEN = 'token';

async function moveLegacySession(): Promise<User | null> {
  const legacy = localStorage.getItem(LEGACY_TOKEN);
  if (!legacy) return null;
  localStorage.removeItem(LEGACY_TOKEN);
  try {
    const res = await fetch(`${API_URL}/api/auth/oturum-tasi`, {
      method: 'POST',
      credentials: 'include',
      headers: { Authorization: `Bearer ${legacy}`, 'X-KaraLevha': '1' },
    });
    if (!res.ok) return null;
    return ((await res.json()) as { user: User }).user;
  } catch {
    return null;
  }
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  // Kullanıcının adı, rolü gibi gizli olmayan bilgiler sayfa hemen dolsun diye saklanır; kimlik çerezdedir
  const [user, setUser] = useState<User | null>(() => {
    try {
      return JSON.parse(localStorage.getItem('user') ?? 'null') as User | null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(true);

  const forget = useCallback(() => {
    setUser(null);
    localStorage.removeItem('user');
    localStorage.removeItem(LEGACY_TOKEN);
  }, []);

  const logout = useCallback(() => {
    forget();
    apiFetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
  }, [forget]);

  const login = useCallback((userData: User) => {
    setUser(userData);
    localStorage.setItem('user', JSON.stringify(userData));
  }, []);

  // Oturum çerezde: geçerli mi, rol ve askı güncel mi sunucuya sorulur
  const refreshUser = useCallback(async () => {
    if (!localStorage.getItem('user')) return;
    try {
      const fresh = await api<User>('/api/auth/me');
      setUser(fresh);
      localStorage.setItem('user', JSON.stringify(fresh));
    } catch {
      // Ağ hatası: kayıtlı bilgiyle devam; oturum geçersizse api() zaten çıkış yaptırır
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const moved = await moveLegacySession();
      if (cancelled) return;
      if (moved) login(moved);
      await refreshUser();
      if (!cancelled) setLoading(false);
    })();

    const onUnauthorized = () => forget();
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'user' && !e.newValue) setUser(null); // başka sekmede çıkış
    };
    window.addEventListener('auth:unauthorized', onUnauthorized);
    window.addEventListener('storage', onStorage);
    return () => {
      cancelled = true;
      window.removeEventListener('auth:unauthorized', onUnauthorized);
      window.removeEventListener('storage', onStorage);
    };
  }, [forget, login, refreshUser]);

  const value = useMemo(
    () => ({ user, loading, login, logout, refreshUser }),
    [user, loading, login, logout, refreshUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
