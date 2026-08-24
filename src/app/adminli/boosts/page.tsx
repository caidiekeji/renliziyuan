'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { ADMIN_NAV } from '@/lib/admin-nav';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmDialog, Modal } from '@/components/ui/Modal';
import { Empty } from '@/components/ui/Empty';
import { Input } from '@/components/ui/Input';
import { Pagination } from '@/components/ui/Pagination';
import { PageLoading } from '@/components/ui/Spinner';
import { Select } from '@/components/ui/Select';
import { useToast } from '@/components/ui/Toast';
import { useRoleGuard } from '@/lib/route-guard';
import { api, qs } from '@/lib/api';
import { formatDate } from '@/lib/utils';

interface AdminBoost {
  id: string;
  company_id: string;
  job_id: string;
  city: string;
  job_type?: string | null;
  bid: number | string;
  status: string;
  start_date: string;
  end_date: string;
  total_cost: number | string;
  created_at: string;
  company: { id: string; name: string; verify_status: string };
  job: { id: string; title: string; status: string };
}

interface BoostStats {
  total: number;
  active: number;
  pending: number;
  total_cost: number;
  by_city: { city: string; count: number; cost: number }[];
}

const BOOST_STATUS_LABEL: Record<string, string> = {
  PENDING: '待审核',
  ACTIVE: '生效中',
  PAUSED: '已暂停',
  EXPIRED: '已过期',
  REJECTED: '已驳回',
};

const STATUS_OPTIONS = [
  { value: '', label: '全部状态' },
  { value: 'PENDING', label: '待审核' },
  { value: 'ACTIVE', label: '生效中' },
  { value: 'PAUSED', label: '已暂停' },
  { value: 'EXPIRED', label: '已过期' },
  { value: 'REJECTED', label: '已驳回' },
];

const REASON_OPTIONS = [
  { value: 'CONTENT_VIOLATION', label: '职位内容违规' },
  { value: 'COMPANY_NOT_VERIFIED', label: '企业未认证' },
  { value: 'BID_TOO_LOW', label: '出价低于最低限价' },
  { value: 'JOB_NOT_ACTIVE', label: '职位未上线' },
  { value: 'OTHER', label: '其他原因' },
];

function AdminBoostsContent() {
  const guarding = useRoleGuard(['ADMIN'], '/');
  const router = useRouter();
  const sp = useSearchParams();
  const { toast } = useToast();

  const page = Number(sp.get('page')) || 1;
  const pageSize = 10;
  const status = sp.get('status') || '';
  const companyId = sp.get('company_id') || '';
  const [statusInput, setStatusInput] = useState(status);
  const [companyInput, setCompanyInput] = useState(companyId);

  const [stats, setStats] = useState<BoostStats | null>(null);
  const [items, setItems] = useState<AdminBoost[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const reload = () => setReloadKey((k) => k + 1);

  const [auditTarget, setAuditTarget] = useState<AdminBoost | null>(null);
  const [auditResult, setAuditResult] = useState<'APPROVED' | 'REJECTED'>('APPROVED');
  const [auditReason, setAuditReason] = useState('');
  const [auditLoading, setAuditLoading] = useState(false);

  useEffect(() => {
    api.get<BoostStats>('/api/admin/boosts/stats').then((r) => r.ok && setStats(r.data));
  }, [reloadKey]);

  useEffect(() => {
    setLoading(true);
    api
      .get<AdminBoost[]>('/api/admin/boosts' + qs({ status: status || undefined, company_id: companyId || undefined, page, pageSize }))
      .then((r) => {
        if (r.ok) {
          setItems(r.data);
          setTotal(Number(r.meta?.total) || 0);
        }
        setLoading(false);
      });
  }, [status, companyId, page, reloadKey]);

  if (guarding) return <PageLoading />;

  const applyFilter = () => {
    const params = new URLSearchParams(sp.toString());
    if (statusInput) params.set('status', statusInput);
    else params.delete('status');
    if (companyInput) params.set('company_id', companyInput);
    else params.delete('company_id');
    params.delete('page');
    router.replace(`/adminli/boosts${params.toString() ? `?${params}` : ''}`);
  };

  const openAudit = (b: AdminBoost, result: 'APPROVED' | 'REJECTED') => {
    setAuditTarget(b);
    setAuditResult(result);
    setAuditReason('');
  };

  const submitAudit = async () => {
    if (!auditTarget) return;
    if (auditResult === 'REJECTED' && !auditReason) return toast('error', '请选择驳回理由');
    setAuditLoading(true);
    const res = await api.patch(`/api/admin/boosts/${auditTarget.id}/audit`, {
      result: auditResult,
      reason: auditReason,
    });
    setAuditLoading(false);
    setAuditTarget(null);
    if (!res.ok) return toast('error', res.error?.message || '审核失败');
    toast('success', auditResult === 'APPROVED' ? '已通过，置顶生效' : '已驳回，冻结金额已退回');
    reload();
  };

  return (
    <DashboardShell nav={ADMIN_NAV} title="管理后台" sub="竞价置顶">
      <h1 className="mb-5 text-xl font-semibold text-text">竞价置顶</h1>
      {/* 数据概览 */}
      <div className="mb-5 grid grid-cols-2 gap-5 lg:grid-cols-4">
        <div className="card p-5">
          <p className="text-sm text-text-secondary">总置顶数</p>
          <p className="mt-1 text-[28px] font-bold leading-tight text-text">{stats?.total ?? '-'}</p>
        </div>
        <div className="card p-5">
          <p className="text-sm text-text-secondary">生效中</p>
          <p className="mt-1 text-[28px] font-bold leading-tight text-text">{stats?.active ?? '-'}</p>
        </div>
        <div className="card p-5">
          <p className="text-sm text-text-secondary">待审核</p>
          <p className="mt-1 text-[28px] font-bold leading-tight text-text">{stats?.pending ?? '-'}</p>
        </div>
        <div className="card p-5">
          <p className="text-sm text-text-secondary">累计花费</p>
          <p className="mt-1 text-[28px] font-bold leading-tight text-text">¥{Number(stats?.total_cost ?? 0).toFixed(2)}</p>
        </div>
      </div>

      {/* 城市分布 */}
      {stats && stats.by_city.length > 0 && (
        <Card className="mb-5">
          <div className="flex flex-wrap gap-3">
            {stats.by_city.map((c) => (
              <span key={c.city} className="rounded-lg bg-bg-subtle px-3 py-1.5 text-xs text-text-secondary">
                {c.city} · {c.count} 个 · ¥{Number(c.cost).toFixed(2)}
              </span>
            ))}
          </div>
        </Card>
      )}

      {/* 筛选 */}
      <Card className="mb-5 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-40">
            <Select label="状态" value={statusInput} onChange={(e) => setStatusInput(e.target.value)} options={STATUS_OPTIONS} />
          </div>
          <Input label="企业 ID" placeholder="输入企业 ID" value={companyInput} onChange={(e) => setCompanyInput(e.target.value)} className="w-56" />
          <div className="flex gap-2">
            <Button onClick={applyFilter}>搜索</Button>
            <Button variant="ghost" onClick={() => { setStatusInput(''); setCompanyInput(''); router.replace('/adminli/boosts'); }}>重置</Button>
          </div>
        </div>
      </Card>

      {loading ? (
        <PageLoading />
      ) : items.length === 0 ? (
        <Card>
          <Empty title="暂无置顶记录" />
        </Card>
      ) : (
        <Card className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead>
                <tr className="border-b border-border bg-bg-subtle text-xs text-text-secondary">
                  <th className="px-3 py-3 font-medium">职位</th>
                  <th className="px-3 py-3 font-medium">企业</th>
                  <th className="px-3 py-3 font-medium">城市</th>
                  <th className="px-3 py-3 font-medium">出价/天</th>
                  <th className="px-3 py-3 font-medium">状态</th>
                  <th className="px-3 py-3 font-medium">投放期</th>
                  <th className="px-3 py-3 font-medium">已花费</th>
                  <th className="px-3 py-3 font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {items.map((b) => (
                  <tr key={b.id} className="border-b border-border/60 last:border-0 hover:bg-bg-subtle/60">
                    <td className="max-w-48 truncate px-3 py-2.5 font-medium text-text">{b.job.title}</td>
                    <td className="max-w-40 truncate px-3 py-2.5 text-text-secondary">{b.company.name}</td>
                    <td className="px-3 py-2.5 text-text-secondary">{b.city}</td>
                    <td className="px-3 py-2.5 text-text">¥{Number(b.bid).toFixed(2)}</td>
                    <td className="px-3 py-2.5">
                      <Badge tone={b.status === 'ACTIVE' ? 'success' : b.status === 'PENDING' ? 'warning' : b.status === 'REJECTED' ? 'danger' : 'neutral'}>
                        {BOOST_STATUS_LABEL[b.status] || b.status}
                      </Badge>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-text-secondary">
                      {formatDate(b.start_date)} ~ {formatDate(b.end_date)}
                    </td>
                    <td className="px-3 py-2.5 text-text-secondary">¥{Number(b.total_cost).toFixed(2)}</td>
                    <td className="px-3 py-2.5">
                      {b.status === 'PENDING' && (
                        <div className="flex gap-1.5">
                          <Button size="sm" variant="secondary" onClick={() => openAudit(b, 'APPROVED')}>
                            通过
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => openAudit(b, 'REJECTED')}>
                            驳回
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-2 pb-2">
            <Pagination page={page} pageSize={pageSize} total={total} />
          </div>
        </Card>
      )}

      {/* 审核确认（通过） */}
      <ConfirmDialog
        open={!!auditTarget && auditResult === 'APPROVED'}
        title="通过置顶"
        message={`确认通过「${auditTarget?.job.title}」在 ${auditTarget?.city} 的置顶？审核通过后按开始日期生效。`}
        onConfirm={submitAudit}
        onCancel={() => setAuditTarget(null)}
        confirmText="确认通过"
        danger={false}
        loading={auditLoading}
      />

      {/* 驳回理由选择 */}
      <Modal
        open={!!auditTarget && auditResult === 'REJECTED'}
        title="驳回理由"
        onClose={() => setAuditTarget(null)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setAuditTarget(null)} disabled={auditLoading}>
              取消
            </Button>
            <Button variant="danger" onClick={submitAudit} loading={auditLoading}>
              确认驳回
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Select label="驳回原因" value={auditReason} onChange={(e) => setAuditReason(e.target.value)} options={REASON_OPTIONS} />
          <p className="text-xs text-text-secondary">驳回后冻结金额将退回企业钱包。</p>
        </div>
      </Modal>
    </DashboardShell>
  );
}

export default function AdminBoostsPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <AdminBoostsContent />
    </Suspense>
  );
}
