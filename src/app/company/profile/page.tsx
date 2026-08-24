'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CompanyShell } from '@/components/company/CompanyShell';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { IndustrySelect } from '@/components/ui/IndustrySelect';
import { PageLoading } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import { useRoleGuard } from '@/lib/route-guard';
import { api } from '@/lib/api';
import { useMyCompanies, type CompanyDetail } from '@/lib/company';
import { COMPANY_VERIFY_LABEL } from '@/lib/utils';

const SIZE_OPTIONS = ['1-20人', '21-50人', '51-100人', '101-300人', '301-500人', '500人以上'];

interface ProfileForm {
  name: string;
  industry_id: string;
  size: string;
  location: string;
  contact_phone: string;
  website: string;
  description: string;
}

const EMPTY_FORM: ProfileForm = {
  name: '',
  industry_id: '',
  size: '',
  location: '',
  contact_phone: '',
  website: '',
  description: '',
};

export default function CompanyProfilePage() {
  const guarding = useRoleGuard(['COMPANY', 'CANDIDATE'], '/');
  const router = useRouter();
  const { toast } = useToast();
  const { current, loading } = useMyCompanies();
  const [form, setForm] = useState<ProfileForm>(EMPTY_FORM);
  const [dataLoading, setDataLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const companyId = current?.company.id;
  const isOwner = current?.role === 'OWNER';
  const isViewer = current?.role === 'VIEWER';

  useEffect(() => {
    if (loading) return;
    if (!current) {
      router.replace('/company/switch');
      return;
    }
  }, [loading, current, router]);

  useEffect(() => {
    if (!companyId) return;
    setDataLoading(true);
    api.get<CompanyDetail>(`/api/companies/${companyId}`).then((r) => {
      if (r.ok) {
        const c = r.data;
        setForm({
          name: c.name || '',
          industry_id: c.industry_id || '',
          size: c.size || '',
          location: c.location || '',
          contact_phone: c.contact_phone || '',
          website: c.website || '',
          description: c.description || '',
        });
      }
      setDataLoading(false);
    });
  }, [companyId]);

  if (guarding) return <PageLoading />;
  if (loading || !current) return <PageLoading />;

  const set = <K extends keyof ProfileForm>(k: K, v: ProfileForm[K]) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    if (!companyId) return;
    if (!form.name.trim()) return toast('error', '请填写企业名称');
    setSaving(true);
    const res = await api.put(`/api/companies/${companyId}`, {
      name: form.name.trim(),
      industry_id: form.industry_id || undefined,
      size: form.size || undefined,
      location: form.location.trim() || undefined,
      contact_phone: form.contact_phone.trim() || undefined,
      website: form.website.trim() || undefined,
      description: form.description.trim() || undefined,
    });
    setSaving(false);
    if (!res.ok) {
      toast('error', res.error?.message || '保存失败');
      return;
    }
    toast('success', '企业资料已保存');
  };

  const submitVerify = async () => {
    if (!companyId) return;
    setVerifying(true);
    const res = await api.post(`/api/companies/${companyId}/verify`);
    setVerifying(false);
    if (!res.ok) {
      toast('error', res.error?.message || '提交失败');
      return;
    }
    toast('success', '认证申请已提交，请等待平台审核');
  };

  return (
    <CompanyShell>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h1 className="text-xl font-semibold text-text">企业资料</h1>
        <Badge tone={current.company.verify_status === 'VERIFIED' ? 'success' : current.company.verify_status === 'PENDING' ? 'warning' : 'default'}>
          {COMPANY_VERIFY_LABEL[current.company.verify_status] || current.company.verify_status}
        </Badge>
      </div>

      {isViewer && (
        <div className="mb-4 rounded-lg border border-border bg-bg-subtle px-4 py-3 text-sm text-text-secondary">
          当前角色为「查看者」，仅可查看企业资料，无法编辑。
        </div>
      )}

      {dataLoading ? (
        <PageLoading />
      ) : (
        <div className="card p-5">
          <div className="space-y-4">
            <Input label="企业名称" maxLength={100} value={form.name} disabled={isViewer} onChange={(e) => set('name', e.target.value)} />
            <div>
              <label className="mb-1.5 block text-sm font-medium text-text">所属行业</label>
              <div className={isViewer ? 'pointer-events-none opacity-60' : ''}>
                <IndustrySelect value={form.industry_id || null} onChange={(v) => set('industry_id', v || '')} />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Select label="企业规模" value={form.size} disabled={isViewer} onChange={(e) => set('size', e.target.value)}>
                <option value="">请选择规模</option>
                {SIZE_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
              <Input label="所在地" maxLength={100} placeholder="如：杭州市西湖区" value={form.location} disabled={isViewer} onChange={(e) => set('location', e.target.value)} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="联系手机" maxLength={20} placeholder="用于求职者一键拨号" value={form.contact_phone} disabled={isViewer} onChange={(e) => set('contact_phone', e.target.value)} />
              <Input label="官网" maxLength={200} placeholder="https://…" value={form.website} disabled={isViewer} onChange={(e) => set('website', e.target.value)} />
            </div>
            <Textarea label="企业简介" rows={5} maxLength={5000} placeholder="介绍公司业务、团队与文化…" value={form.description} disabled={isViewer} onChange={(e) => set('description', e.target.value)} />

            {/* 移动端 sticky 操作栏（底部 Tab 之上），桌面回到正常流 */}
            <div className="sticky bottom-24 z-10 flex flex-wrap gap-2 border-t border-border bg-white pt-4 lg:static lg:border-0 lg:pt-0">
              {!isViewer && (
                <Button onClick={save} loading={saving}>保存资料</Button>
              )}
              {isOwner && (
                <Button variant="secondary" onClick={submitVerify} loading={verifying}>提交企业认证</Button>
              )}
            </div>
          </div>
        </div>
      )}
    </CompanyShell>
  );
}
