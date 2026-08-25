'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CompanyShell } from '@/components/company/CompanyShell';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { IndustrySelect } from '@/components/ui/IndustrySelect';
import { PageLoading } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import { useRoleGuard } from '@/lib/route-guard';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';

const SIZE_OPTIONS = ['1-20人', '21-50人', '51-100人', '101-300人', '301-500人', '500人以上'];

export default function CompanyCreatePage() {
  const guarding = useRoleGuard(['COMPANY', 'CANDIDATE'], '/');
  const router = useRouter();
  const { toast } = useToast();
  const { setCompanyId } = useAuth();
  const [name, setName] = useState('');
  const [industryId, setIndustryId] = useState('');
  const [size, setSize] = useState('');
  const [location, setLocation] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [website, setWebsite] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  if (guarding) return <PageLoading />;

  const submit = async () => {
    if (!name.trim()) return toast('error', '请填写企业名称');
    setSaving(true);
    const res = await api.post<{ id: string }>('/api/companies', {
      name: name.trim(),
      industry_id: industryId || undefined,
      size: size || undefined,
      location: location.trim() || undefined,
      contact_phone: contactPhone.trim() || undefined,
      website: website.trim() || undefined,
      description: description.trim() || undefined,
    });
    setSaving(false);
    if (!res.ok) return toast('error', res.error?.message || '创建失败');
    toast('success', '企业创建成功');
    setCompanyId(res.data.id);
    router.push('/company');
  };

  return (
    <CompanyShell>
      <div className="mb-4">
        <h1 className="text-xl font-semibold text-text">创建企业</h1>
        <p className="mt-1 text-sm text-text-secondary">填写企业基本信息，创建后可进入企业工作台</p>
      </div>

      <div className="card p-6">
        <div className="space-y-4">
          <Input label="企业名称" required maxLength={100} placeholder="请输入企业名称" value={name} onChange={(e) => setName(e.target.value)} />
          <div>
            <label className="mb-1.5 block text-sm font-medium text-text">所属行业</label>
            <IndustrySelect value={industryId || null} onChange={(v) => setIndustryId(v || '')} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-text">企业规模</label>
              <select
                value={size}
                onChange={(e) => setSize(e.target.value)}
                className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-text"
              >
                <option value="">请选择规模</option>
                {SIZE_OPTIONS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <Input label="所在地" maxLength={100} placeholder="如：杭州市西湖区" value={location} onChange={(e) => setLocation(e.target.value)} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="联系手机" maxLength={20} placeholder="用于求职者一键拨号" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} />
            <Input label="官网" maxLength={200} placeholder="https://…" value={website} onChange={(e) => setWebsite(e.target.value)} />
          </div>
          <Textarea label="企业简介" rows={5} maxLength={5000} placeholder="介绍公司业务、团队与文化…" value={description} onChange={(e) => setDescription(e.target.value)} />

          <div className="flex gap-2 border-t border-border pt-4">
            <Button onClick={submit} loading={saving}>创建企业</Button>
            <Button variant="secondary" onClick={() => router.back()}>取消</Button>
          </div>
        </div>
      </div>
    </CompanyShell>
  );
}
