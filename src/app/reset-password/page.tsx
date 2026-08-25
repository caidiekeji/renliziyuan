'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PublicHeader, PublicFooter } from '@/components/layout/PublicLayout';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import { useCountdown } from '@/lib/use-countdown';
import { PageLoading } from '@/components/ui/Spinner';

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <ResetPasswordContent />
    </Suspense>
  );
}

function ResetPasswordContent() {
  const router = useRouter();
  const { toast } = useToast();
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const { left, start } = useCountdown();

  const sendCode = async () => {
    if (!/^1[3-9]\d{9}$/.test(phone)) return toast('error', '请输入正确的手机号');
    const res = await api.post('/api/auth/send-code', { phone, purpose: 'RESET' });
    if (res.ok) {
      toast('success', (res.data as any)?.message || '验证码已发送');
      start();
    } else {
      toast('error', res.error?.message || '发送失败');
    }
  };

  const submit = async () => {
    if (!/^1[3-9]\d{9}$/.test(phone)) return toast('error', '请输入正确的手机号');
    if (code.length !== 6) return toast('error', '请输入 6 位验证码');
    if (password.length < 6) return toast('error', '密码至少 6 位');
    if (password !== confirm) return toast('error', '两次输入的密码不一致');
    setLoading(true);
    const res = await api.post('/api/auth/reset-password', { phone, code, password });
    setLoading(false);
    if (!res.ok) return toast('error', res.error?.message || '重置失败');
    toast('success', '密码已重置，请重新登录');
    router.push('/login');
  };

  return (
    <div className="min-h-screen bg-bg">
      <PublicHeader />
      <div className="mx-auto flex max-w-md flex-col px-4 py-12">
        <div className="card p-6 sm:p-8">
          <h1 className="text-xl font-semibold text-text">找回密码</h1>
          <p className="mt-1 text-sm text-text-secondary">通过手机短信验证码重置登录密码，重置后其他设备将退出登录</p>

          <div className="mt-6 space-y-4">
            <Input label="手机号" placeholder="请输入注册手机号" maxLength={11} value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))} />
            <div>
              <label className="mb-1.5 block text-sm font-medium text-text">验证码</label>
              <div className="flex gap-2">
                <Input placeholder="6 位验证码" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} />
                <Button variant="secondary" onClick={sendCode} disabled={left > 0} className="shrink-0">
                  {left > 0 ? `${left}s 后重发` : '获取验证码'}
                </Button>
              </div>
            </div>
            <Input label="新密码" type="password" placeholder="至少 6 位" maxLength={64} value={password} onChange={(e) => setPassword(e.target.value)} />
            <Input label="确认新密码" type="password" placeholder="再次输入新密码" maxLength={64} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            <Button className="w-full" size="lg" onClick={submit} loading={loading}>
              重置密码
            </Button>
          </div>

          <p className="mt-6 text-center text-sm text-text-secondary">
            想起密码了？
            <Link href="/login" className="text-text hover:underline">
              返回登录
            </Link>
          </p>
        </div>
      </div>
      <PublicFooter />
    </div>
  );
}
