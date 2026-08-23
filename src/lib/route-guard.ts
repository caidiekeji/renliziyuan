'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from './auth-context';

/**
 * 角色路由守卫：未登录跳登录页；角色不符跳 fallback。
 * 返回 true 表示"仍在守卫中（应渲染占位）"。
 */
export function useRoleGuard(roles: string[], fallback = '/'): boolean {
  const { user, loading } = useAuth();
  const router = useRouter();
  const allowed = user ? roles.includes(user.role) : false;

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace('/login');
    else if (!allowed) router.replace(fallback);
  }, [loading, user, allowed, router, fallback]);

  return loading || !allowed;
}
