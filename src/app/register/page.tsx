'use client';

import { Suspense, useEffect, useState } from 'react';
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

export default function RegisterPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <RegisterContent />
    </Suspense>
  );
}

function RegisterContent() {
  const router = useRouter();
  const { toast } = useToast();
  const { refresh, setCompanyId } = useAuth();
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'CANDIDATE' | 'COMPANY'>('CANDIDATE');
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [agreePrivacy, setAgreePrivacy] = useState(false);
  const [policiesOk, setPoliciesOk] = useState(false);
  const [loading, setLoading] = useState(false);
  const { left, start } = useCountdown();

  useEffect(() => {
    // 校验条款存在性：无发布版条款时注册入口禁用
    Promise.all([api.get('/api/policies/terms'), api.get('/api/policies/privacy')]).then(([t, p]) => {
      setPoliciesOk(t.ok && p.ok);
    });
  }, []);

  const sendCode = async () => {
    if (!/^1[3-9]\d{9}$/.test(phone)) return toast('error', '请输入正确的手机号');
    const res = await api.post('/api/auth/send-code', { phone, purpose: 'LOGIN' });
    if (res.ok) {
      toast('success', (res.data as any)?.message || '验证码已发送');
      start();
    } else toast('error', res.error?.message || '发送失败');
  };

  const submit = async () => {
    if (!policiesOk) return toast('error', '平台条款尚未发布，暂不可注册');
    if (!/^1[3-9]\d{9}$/.test(phone)) return toast('error', '请输入正确的手机号');
    if (code.length !== 6) return toast('error', '请输入 6 位验证码');
    if (!name.trim()) return toast('error', '请输入昵称');
    if (!agreeTerms || !agreePrivacy) return toast('error', '请阅读并同意协议条款');
    setLoading(true);
    const res = await api.post<{ user: { role: string }; company_id?: string }>('/api/auth/register', {
      phone,
      code,
      name: name.trim(),
      password: password || undefined,
      role,
      agree_terms: agreeTerms,
      agree_privacy: agreePrivacy,
    });
    setLoading(false);
    if (!res.ok) return toast('error', res.error?.message || '注册失败');
    toast('success', '注册成功');
    await refresh();
    // 企业角色注册时，后端自动创建企业并返回 company_id，设置到上下文中
    if (role === 'COMPANY' && res.data.company_id) {
      setCompanyId(res.data.company_id);
    }
    router.push(role === 'COMPANY' ? '/company' : '/candidate');
  };

  return (
    <div className="min-h-screen bg-bg">
      <PublicHeader />
      <div className="mx-auto flex max-w-md flex-col px-4 py-10">
        <div className="card p-6 sm:p-8">
          <h1 className="text-xl font-semibold text-text">注册账号</h1>
          <p className="mt-1 text-sm text-text-secondary">选择你的身份，开启招聘/求职之旅</p>

          <div className="mt-5 grid grid-cols-2 gap-2">
            {(
              [
                { v: 'CANDIDATE', label: '我是求职者', desc: '找工作、看职位、联系企业' },
                { v: 'COMPANY', label: '我是企业', desc: '发职位、招人才、建团队' },
              ] as const
            ).map((r) => (
              <button
                key={r.v}
                type="button"
                onClick={() => setRole(r.v)}
                className={`rounded-xl border p-3 text-left transition-colors ${
                  role === r.v ? 'border-primary bg-primary-soft' : 'border-border hover:border-text-secondary/40'
                }`}
              >
                <p className={`text-sm font-semibold ${role === r.v ? 'text-text' : 'text-text'}`}>{r.label}</p>
                <p className="mt-0.5 text-xs text-text-secondary">{r.desc}</p>
              </button>
            ))}
          </div>

          <div className="mt-5 space-y-4">
            <Input label="手机号" placeholder="请输入手机号" maxLength={11} value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))} />
            <div>
              <label className="mb-1.5 block text-sm font-medium text-text">验证码</label>
              <div className="flex gap-2">
                <Input placeholder="6 位验证码" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} />
                <Button variant="secondary" onClick={sendCode} disabled={left > 0} className="shrink-0">
                  {left > 0 ? `${left}s 后重发` : '获取验证码'}
                </Button>
              </div>
            </div>
            <Input label="昵称" placeholder="请输入昵称" maxLength={20} value={name} onChange={(e) => setName(e.target.value)} />
            <Input label="密码（可选，可用于账号密码登录）" type="password" placeholder="留空则仅使用短信验证码登录" value={password} onChange={(e) => setPassword(e.target.value)} />

            <div className="space-y-2 text-sm text-text-secondary">
              <label className="flex items-start gap-2">
                <input type="checkbox" checked={agreeTerms} onChange={(e) => setAgreeTerms(e.target.checked)} className="mt-0.5 accent-primary" />
                <span>
                  我已阅读并同意
                  <Link href="/terms" target="_blank" className="text-text hover:underline">《使用须知》</Link>
                  {!policiesOk && <span className="ml-1 text-danger">（条款尚未发布，注册暂不可用）</span>}
                </span>
              </label>
              <label className="flex items-start gap-2">
                <input type="checkbox" checked={agreePrivacy} onChange={(e) => setAgreePrivacy(e.target.checked)} className="mt-0.5 accent-primary" />
                <span>
                  我已阅读并同意
                  <Link href="/privacy" target="_blank" className="text-text hover:underline">《隐私政策》</Link>
                </span>
              </label>
            </div>

            <Button className="w-full" size="lg" onClick={submit} loading={loading} disabled={!policiesOk}>
              注册
            </Button>
          </div>

          <p className="mt-6 text-center text-sm text-text-secondary">
            已有账号？
            <Link href="/login" className="text-text hover:underline">
              去登录
            </Link>
          </p>
        </div>
      </div>
      <PublicFooter />
    </div>
  );
}
