'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PublicHeader, PublicFooter } from '@/components/layout/PublicLayout';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/lib/auth-context';
import { useCountdown } from '@/lib/use-countdown';
import { PageLoading } from '@/components/ui/Spinner';

type LoginMode = 'sms' | 'password';

export default function LoginPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <LoginContent />
    </Suspense>
  );
}

function LoginContent() {
  const router = useRouter();
  const { toast } = useToast();
  const { refresh } = useAuth();
  const [mode, setMode] = useState<LoginMode>('sms');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { left, start } = useCountdown();

  const sendCode = async () => {
    if (!/^1[3-9]\d{9}$/.test(phone)) return toast('error', '请输入正确的手机号');
    const res = await api.post('/api/auth/send-code', { phone, purpose: 'LOGIN' });
    if (res.ok) {
      toast('success', (res.data as any)?.message || '验证码已发送');
      start();
    } else {
      toast('error', res.error?.message || '发送失败');
    }
  };

  const submitSms = async () => {
    if (!/^1[3-9]\d{9}$/.test(phone)) return toast('error', '请输入正确的手机号');
    if (code.length !== 6) return toast('error', '请输入 6 位验证码');
    setLoading(true);
    const res = await api.post<{ user: { role: string } }>('/api/auth/login', { phone, code });
    setLoading(false);
    if (!res.ok) return toast('error', res.error?.message || '登录失败');
    await loginSuccess(res.data.user.role);
  };

  const submitPassword = async () => {
    if (!/^1[3-9]\d{9}$/.test(phone)) return toast('error', '请输入正确的手机号');
    if (password.length < 6) return toast('error', '请输入至少 6 位密码');
    setLoading(true);
    const res = await api.post<{ user: { role: string } }>('/api/auth/password-login', { phone, password });
    setLoading(false);
    if (!res.ok) return toast('error', res.error?.message || '登录失败');
    await loginSuccess(res.data.user.role);
  };

  const loginSuccess = async (role: string) => {
    await refresh();
    router.push(role === 'ADMIN' ? '/adminli' : role === 'COMPANY' ? '/company' : '/candidate');
  };

  return (
    <div className="min-h-screen bg-bg">
      <PublicHeader />
      <div className="mx-auto flex max-w-md flex-col px-4 py-12">
        <div className="card p-6 sm:p-8">
          <h1 className="text-xl font-semibold text-text">登录</h1>

          {/* 登录方式切换 */}
          <div className="mt-4 grid grid-cols-2 gap-1 rounded-lg bg-bg p-1">
            <button
              type="button"
              onClick={() => setMode('sms')}
              className={`rounded-md py-2 text-sm font-medium transition-colors ${
                mode === 'sms' ? 'bg-white text-text shadow-sm' : 'text-text-secondary hover:text-text'
              }`}
            >
              短信验证码登录
            </button>
            <button
              type="button"
              onClick={() => setMode('password')}
              className={`rounded-md py-2 text-sm font-medium transition-colors ${
                mode === 'password' ? 'bg-white text-text shadow-sm' : 'text-text-secondary hover:text-text'
              }`}
            >
              账号密码登录
            </button>
          </div>

          <div className="mt-6 space-y-4">
            <Input label="手机号" placeholder="请输入手机号" maxLength={11} value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))} />

            {mode === 'sms' ? (
              <>
                <p className="text-sm text-text-secondary">未注册将自动注册</p>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-text">验证码</label>
                  <div className="flex gap-2">
                    <Input placeholder="6 位验证码" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} />
                    <Button variant="secondary" onClick={sendCode} disabled={left > 0} className="shrink-0">
                      {left > 0 ? `${left}s 后重发` : '获取验证码'}
                    </Button>
                  </div>
                </div>
                <Button className="w-full" size="lg" onClick={submitSms} loading={loading}>
                  登录
                </Button>
              </>
            ) : (
              <>
                <div>
                  <Input label="密码" type="password" placeholder="请输入密码" maxLength={64} value={password} onChange={(e) => setPassword(e.target.value)} />
                  <div className="mt-1.5 text-right">
                    <Link href="/reset-password" className="text-sm text-text-secondary hover:text-text">
                      忘记密码？
                    </Link>
                  </div>
                </div>
                <Button className="w-full" size="lg" onClick={submitPassword} loading={loading}>
                  登录
                </Button>
                <p className="text-sm text-text-secondary">未设置过密码？请使用短信验证码登录，或在个人中心设置密码</p>
              </>
            )}
          </div>

          <p className="mt-6 text-center text-sm text-text-secondary">
            还没有账号？
            <Link href="/register" className="text-text hover:underline">
              立即注册
            </Link>
          </p>
        </div>
      </div>
      <PublicFooter />
    </div>
  );
}
