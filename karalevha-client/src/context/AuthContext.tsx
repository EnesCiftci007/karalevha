import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import { User } from '../types';
import { api } from '../services/api';

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (userData: User, userToken: string) => void;
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

function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return typeof payload.exp !== 'number' || payload.exp * 1000 < Date.now();
  } catch {
    return true;
  }
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('user');
    localStorage.removeItem('token');
  }, []);

  const login = useCallback((userData: User, userToken: string) => {
    setUser(userData);
    setToken(userToken);
    localStorage.setItem('user', JSON.stringify(userData));
    localStorage.setItem('token', userToken);
  }, []);

  // Rol ve askı oturum boyunca değişebilir; açılışta ve istendiğinde sunucudan okunur
  const refreshUser = useCallback(async () => {
    if (!localStorage.getItem('token')) return;
    try {
      const fresh = await api<User>('/api/auth/me');
      setUser(fresh);
      localStorage.setItem('user', JSON.stringify(fresh));
    } catch {
      // Ağ hatası: kayıtlı bilgiyle devam; jeton geçersizse api() zaten çıkış yaptırır
    }
  }, []);

  useEffect(() => {
    try {
      const savedUser = localStorage.getItem('user');
      const savedToken = localStorage.getItem('token');
      if (savedUser && savedToken && !isTokenExpired(savedToken)) {
        setUser(JSON.parse(savedUser) as User);
        setToken(savedToken);
        refreshUser();
      } else {
        logout();
      }
    } catch {
      logout(); // bozuk veri: temizle, uygulama çökmesin
    } finally {
      setLoading(false);
    }

    const onUnauthorized = () => logout();
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'token' && !e.newValue) logout(); // başka sekmede çıkış
    };
    window.addEventListener('auth:unauthorized', onUnauthorized);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('auth:unauthorized', onUnauthorized);
      window.removeEventListener('storage', onStorage);
    };
  }, [logout, refreshUser]);

  const value = useMemo(
    () => ({ user, token, loading, login, logout, refreshUser }),
    [user, token, loading, login, logout, refreshUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
