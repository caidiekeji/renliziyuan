'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/lib/auth-context';

/** 独立管理员密码登录入口（仅限 ADMIN 角色） */
export default function AdminLoginPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { refresh } = useAuth();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!/^1[3-9]\d{9}$/.test(phone)) return toast('error', '请输入正确的手机号');
    if (!password) return toast('error', '请输入密码');
    setLoading(true);
    const res = await api.post<{ user: { role: string } }>('/api/auth/password-login', { phone, password });
    setLoading(false);
    if (!res.ok) return toast('error', res.error?.message || '登录失败');
    if (res.data.user.role !== 'ADMIN') {
      // 清除非管理员会话后拒绝进入后台
      await api.post('/api/auth/logout').catch(() => {});
      toast('error', '该入口仅限管理员使用');
      router.replace('/login');
      return;
    }
    await refresh();
    router.replace('/adminli');
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4">
      <div className="card w-full max-w-sm p-6 sm:p-8">
        <h1 className="text-xl font-semibold text-text">管理后台登录</h1>
        <p className="mt-1 text-sm text-text-secondary">仅限管理员账号</p>
        <div className="mt-6 space-y-4">
          <Input
            label="手机号"
            placeholder="管理员手机号"
            maxLength={11}
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
          />
          <Input
            label="密码"
            type="password"
            placeholder="请输入密码"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
          />
          <Button className="w-full" size="lg" onClick={submit} loading={loading}>
            登录
          </Button>
        </div>
        <p className="mt-6 text-center text-sm text-text-secondary">
          返回<Link href="/" className="text-text hover:underline">首页</Link>
        </p>
      </div>
    </div>
  );
}