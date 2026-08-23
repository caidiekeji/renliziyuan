'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, setApiCompanyContext } from './api';

export interface MyCompany {
  id: string;
  name: string;
  logo?: string | null;
  verify_status: string;
  role: string;
}

export interface Me {
  id: string;
  phone?: string | null;
  name: string;
  avatar?: string | null;
  bio?: string | null;
  role: string;
  title?: string | null;
  city?: string | null;
  skills?: string[];
  status: string;
  companies: MyCompany[];
  unread: number;
}

interface AuthState {
  user: Me | null;
  loading: boolean;
  refresh: () => Promise<Me | null>;
  logout: () => Promise<void>;
  /** 当前企业上下文 */
  companyId: string | null;
  setCompanyId: (id: string | null) => void;
}

const AuthContext = createContext<AuthState>({
  user: null,
  loading: true,
  refresh: async () => null,
  logout: async () => {},
  companyId: null,
  setCompanyId: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [companyId, setCompanyIdState] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const res = await api.get<Me>('/api/me');
    if (res.ok) {
      setUser(res.data);
      return res.data;
    }
    setUser(null);
    return null;
  }, []);

  useEffect(() => {
    refresh().finally(() => setLoading(false));
    // 默认企业上下文（Cookie 记忆）
    const saved = document.cookie
      .split(';')
      .find((c) => c.trim().startsWith('default_company='))
      ?.split('=')[1];
    if (saved) {
      setCompanyIdState(saved);
      setApiCompanyContext(saved);
    }
  }, [refresh]);

  const logout = useCallback(async () => {
    await api.post('/api/auth/logout').catch(() => {});
    setUser(null);
    window.location.href = '/login';
  }, []);

  const setCompanyId = useCallback((id: string | null) => {
    setCompanyIdState(id);
    setApiCompanyContext(id);
    if (id) document.cookie = `default_company=${id}; path=/; max-age=2592000`;
    else document.cookie = 'default_company=; path=/; max-age=0';
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, refresh, logout, companyId, setCompanyId }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
