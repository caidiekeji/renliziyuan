'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmDialog, Modal } from '@/components/ui/Modal';
import { Empty } from '@/components/ui/Empty';
import { IndustrySelect } from '@/components/ui/IndustrySelect';
import { Input } from '@/components/ui/Input';
import { Pagination } from '@/components/ui/Pagination';
import { PageLoading } from '@/components/ui/Spinner';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { useToast } from '@/components/ui/Toast';
import { useRoleGuard } from '@/lib/route-guard';
import { api, qs } from '@/lib/api';
import { COMPANY_VERIFY_LABEL, formatDate } from '@/lib/utils';
import { ADMIN_NAV } from '@/lib/admin-nav';

interface AdminCompany {
  id: string;
  owner_id: string;
  name: string;
  logo?: string | null;
  industry_id?: string | null;
  size?: string | null;
  location?: string | null;
  contact_phone?: string | null;
  website?: string | null;
  description?: string | null;
  founded_at?: string | null;
  verify_status: string;
  avg_rating?: number | string | null;
  review_count?: number;
  created_at?: string;
  industry?: { id: string; name: string } | null;
  /** 后端暂未返回职位数，展示占位，见 TODO */
  _count?: { jobs?: number };
}

const VERIFY_OPTIONS = [
  { value: '', label: '全部状态' },
  { value: 'PENDING', label: '待审核' },
  { value: 'VERIFIED', label: '已认证' },
  { value: 'REJECTED', label: '已驳回' },
];

function CompaniesContent() {
  const guarding = useRoleGuard(['ADMIN'], '/');
  const router = useRouter();
  const sp = useSearchParams();
  const { toast } = useToast();

  const page = Number(sp.get('page')) || 1;
  const pageSize = 10;

  const keyword = sp.get('keyword') || '';
  const verifyStatus = sp.get('verify_status') || '';

  const [kwInput, setKwInput] = useState(keyword);
  const [verifyInput, setVerifyInput] = useState(verifyStatus);

  const [companies, setCompanies] = useState<AdminCompany[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const reload = () => setReloadKey((k) => k + 1);

  // 编辑资料
  const [editTarget, setEditTarget] = useState<AdminCompany | null>(null);
  const [editForm, setEditForm] = useState({
    name: '',
    size: '',
    location: '',
    contact_phone: '',
    website: '',
    description: '',
    industry_id: '' as string | null,
  });
  const [editSaving, setEditSaving] = useState(false);

  // 关停
  const [deleteTarget, setDeleteTarget] = useState<AdminCompany | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    api
      .get<AdminCompany[]>('/api/admin/companies' + qs({ keyword, verify_status: verifyStatus, page, pageSize }))
      .then((r) => {
        if (r.ok) {
          setCompanies(r.data);
          setTotal(Number(r.meta?.total) || 0);
        }
        setLoading(false);
      });
  }, [keyword, verifyStatus, page, reloadKey]);

  if (guarding) return <PageLoading />;

  const applyFilter = () => {
    const params = new URLSearchParams(sp.toString());
    if (kwInput) params.set('keyword', kwInput);
    else params.delete('keyword');
    if (verifyInput) params.set('verify_status', verifyInput);
    else params.delete('verify_status');
    params.delete('page');
    router.replace(`/adminli/companies${params.toString() ? `?${params}` : ''}`);
  };

  const setVerify = async (c: AdminCompany, next: 'VERIFIED' | 'REJECTED') => {
    const res = await api.put(`/api/admin/companies/${c.id}`, { verify_status: next });
    if (!res.ok) {
      toast('error', res.error?.message || '操作失败');
      return;
    }
    toast('success', next === 'VERIFIED' ? `已认证 ${c.name}` : `已驳回 ${c.name}`);
    reload();
  };

  const openEdit = (c: AdminCompany) => {
    setEditTarget(c);
    setEditForm({
      name: c.name || '',
      size: c.size || '',
      location: c.location || '',
      contact_phone: c.contact_phone || '',
      website: c.website || '',
      description: c.description || '',
      industry_id: c.industry_id || null,
    });
  };

  const saveEdit = async () => {
    if (!editTarget) return;
    if (!editForm.name.trim()) {
      toast('error', '企业名称不能为空');
      return;
    }
    setEditSaving(true);
    const res = await api.put(`/api/admin/companies/${editTarget.id}`, {
      name: editForm.name,
      size: editForm.size || undefined,
      location: editForm.location || undefined,
      contact_phone: editForm.contact_phone || undefined,
      website: editForm.website || undefined,
      description: editForm.description || undefined,
      industry_id: editForm.industry_id || undefined,
    });
    setEditSaving(false);
    if (!res.ok) {
      toast('error', res.error?.message || '保存失败');
      return;
    }
    toast('success', '企业资料已更新');
    setEditTarget(null);
    reload();
  };

  const removeCompany = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    const res = await api.del(`/api/admin/companies/${deleteTarget.id}`);
    setDeleteLoading(false);
    if (!res.ok) {
      toast('error', res.error?.message || '关停失败');
      setDeleteTarget(null);
      return;
    }
    toast('success', `已关停 ${deleteTarget.name}`);
    setDeleteTarget(null);
    reload();
  };

  return (
    <DashboardShell nav={ADMIN_NAV} title="管理后台" sub="企业管理">
      <h1 className="mb-5 text-xl font-semibold text-text">企业管理（{total}）</h1>

      <Card className="mb-4 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-full sm:w-56">
            <Input
              label="搜索"
              placeholder="企业名称"
              value={kwInput}
              onChange={(e) => setKwInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && applyFilter()}
            />
          </div>
          <div className="w-full sm:w-40">
            <Select label="认证状态" options={VERIFY_OPTIONS} value={verifyInput} onChange={(e) => setVerifyInput(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <Button onClick={applyFilter}>搜索</Button>
            <Button
              variant="ghost"
              onClick={() => {
                setKwInput('');
                setVerifyInput('');
                router.replace('/adminli/companies');
              }}
            >
              重置
            </Button>
          </div>
        </div>
      </Card>

      <Card>
        {loading ? (
          <PageLoading />
        ) : companies.length === 0 ? (
          <Empty title="暂无企业" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-bg-subtle text-xs text-text-secondary">
                  <th className="px-3 py-3 font-medium">企业名称</th>
                  <th className="px-3 py-3 font-medium">行业</th>
                  <th className="px-3 py-3 font-medium">规模</th>
                  <th className="px-3 py-3 font-medium">认证状态</th>
                  <th className="px-3 py-3 font-medium">职位数</th>
                  <th className="px-3 py-3 font-medium">注册时间</th>
                  <th className="px-3 py-3 font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {companies.map((c) => (
                  <tr key={c.id} className="border-b border-border/60 last:border-0 hover:bg-bg-subtle/60">
                    <td className="px-3 py-2.5 font-medium text-text">{c.name}</td>
                    <td className="px-3 py-2.5 text-text-secondary">{c.industry?.name || '-'}</td>
                    <td className="px-3 py-2.5 text-text-secondary">{c.size || '-'}</td>
                    <td className="px-3 py-2.5">
                      <Badge tone={c.verify_status === 'VERIFIED' ? 'success' : c.verify_status === 'REJECTED' ? 'danger' : 'warning'}>
                        {COMPANY_VERIFY_LABEL[c.verify_status] || c.verify_status}
                      </Badge>
                    </td>
                    {/* TODO: /api/admin/companies 未返回职位数（无 _count），暂显示占位 */}
                    <td className="px-3 py-2.5 text-text-secondary">{c._count?.jobs ?? '-'}</td>
                    <td className="px-3 py-2.5 text-text-secondary">{formatDate(c.created_at)}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex flex-wrap gap-1.5">
                        {c.verify_status !== 'VERIFIED' && (
                          <Button variant="secondary" size="sm" onClick={() => setVerify(c, 'VERIFIED')}>
                            认证通过
                          </Button>
                        )}
                        {c.verify_status !== 'REJECTED' && (
                          <Button variant="ghost" size="sm" onClick={() => setVerify(c, 'REJECTED')}>
                            驳回
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" onClick={() => openEdit(c)}>
                          编辑
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(c)}>
                          关停
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="px-2 pb-2">
          <Pagination page={page} pageSize={pageSize} total={total} />
        </div>
      </Card>

      {/* 编辑资料 */}
      <Modal
        open={!!editTarget}
        title={`编辑企业资料 - ${editTarget?.name || ''}`}
        onClose={() => setEditTarget(null)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditTarget(null)} disabled={editSaving}>
              取消
            </Button>
            <Button onClick={saveEdit} loading={editSaving}>
              保存
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Input label="企业名称" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
          <div>
            <label className="mb-1.5 block text-sm font-medium text-text">行业</label>
            <IndustrySelect value={editForm.industry_id} onChange={(v) => setEditForm({ ...editForm, industry_id: v })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="规模" placeholder="如 100-499人" value={editForm.size} onChange={(e) => setEditForm({ ...editForm, size: e.target.value })} />
            <Input label="所在地" placeholder="城市 / 区域" value={editForm.location} onChange={(e) => setEditForm({ ...editForm, location: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="联系电话" placeholder="企业联系手机号" value={editForm.contact_phone} onChange={(e) => setEditForm({ ...editForm, contact_phone: e.target.value })} />
            <Input label="官网" placeholder="https://" value={editForm.website} onChange={(e) => setEditForm({ ...editForm, website: e.target.value })} />
          </div>
          <Textarea
            label="企业简介"
            rows={3}
            placeholder="企业介绍"
            value={editForm.description}
            onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
          />
        </div>
      </Modal>

      {/* 关停确认 */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="关停企业"
        message={`确定关停「${deleteTarget?.name || ''}」吗？该企业全部职位将下线，成员关系将被移除，且不可恢复。`}
        confirmText="关停"
        onConfirm={removeCompany}
        onCancel={() => setDeleteTarget(null)}
        loading={deleteLoading}
      />
    </DashboardShell>
  );
}

export default function AdminCompaniesPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <CompaniesContent />
    </Suspense>
  );
}
