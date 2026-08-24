'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { api, setApiCompanyContext } from './api';
import { io, type Socket } from 'socket.io-client';

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

  // 全局 socket：登录后建立，接收未读通知（不依赖 ChatWindow 是否挂载）
  const globalSocketRef = useRef<Socket | null>(null);
  useEffect(() => {
    if (!user) return;
    const connect = async () => {
      const t = await api.get<{ token: string }>('/api/socket-token');
      if (!t.ok) return;
      const s = io({ path: '/socket.io', auth: { token: t.data.token } });
      globalSocketRef.current = s;
      s.on('chat:unread', ({ conversationId }: { conversationId: string }) => {
        window.dispatchEvent(new CustomEvent('chat:unread-inc', { detail: { conversationId } }));
      });
    };
    connect();
    return () => {
      globalSocketRef.current?.disconnect();
      globalSocketRef.current = null;
    };
  }, [user?.id]);

  // 监听已读事件，实时更新侧栏角标（递减）
  useEffect(() => {
    const handler = (e: Event) => {
      const { messageIds } = (e as CustomEvent).detail;
      setUser((prev) => prev ? { ...prev, unread: Math.max(0, prev.unread - messageIds.length) } : prev);
    };
    window.addEventListener('chat:read', handler);
    return () => window.removeEventListener('chat:read', handler);
  }, []);

  // 监听新消息，实时更新侧栏角标（递增，当前活跃对话除外）
  useEffect(() => {
    const handler = (e: Event) => {
      const { conversationId } = (e as CustomEvent).detail;
      const active = (window as any).__activeConversationId;
      if (active === conversationId) return; // 正在看该对话，不算未读
      setUser((prev) => prev ? { ...prev, unread: prev.unread + 1 } : prev);
    };
    window.addEventListener('chat:unread-inc', handler);
    return () => window.removeEventListener('chat:unread-inc', handler);
  }, []);

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
