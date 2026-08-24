'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/Modal';
import { Empty } from '@/components/ui/Empty';
import { Input } from '@/components/ui/Input';
import { Pagination } from '@/components/ui/Pagination';
import { PageLoading } from '@/components/ui/Spinner';
import { Select } from '@/components/ui/Select';
import { useToast } from '@/components/ui/Toast';
import { useRoleGuard } from '@/lib/route-guard';
import { api, qs } from '@/lib/api';
import { JOB_STATUS_LABEL, AUDIT_STATUS_LABEL, formatSalary } from '@/lib/utils';
import { ADMIN_NAV } from '@/lib/admin-nav';

interface AdminJob {
  id: string;
  company_id: string;
  title: string;
  salary_min?: number | null;
  salary_max?: number | null;
  salary_unit?: string | null;
  city?: string | null;
  status: string;
  audit_status: string;
  is_featured?: boolean;
  views?: number;
  deleted_at?: string | null;
  created_at?: string;
  company?: { id: string; name: string };
  boosts?: { boost?: number | string; forced?: boolean }[];
}

const STATUS_OPTIONS = [
  { value: '', label: '全部状态' },
  { value: 'OPEN', label: '在招' },
  { value: 'CLOSED', label: '已下线' },
];

const AUDIT_OPTIONS = [
  { value: '', label: '全部审核' },
  { value: 'PENDING', label: '待审核' },
  { value: 'APPROVED', label: '已通过' },
  { value: 'REJECTED', label: '已驳回' },
];

function JobsContent() {
  const guarding = useRoleGuard(['ADMIN'], '/');
  const router = useRouter();
  const sp = useSearchParams();
  const { toast } = useToast();

  const page = Number(sp.get('page')) || 1;
  const pageSize = 10;

  const keyword = sp.get('keyword') || '';
  const status = sp.get('status') || '';
  const auditStatus = sp.get('audit_status') || '';

  const [kwInput, setKwInput] = useState(keyword);
  const [statusInput, setStatusInput] = useState(status);
  const [auditInput, setAuditInput] = useState(auditStatus);

  const [jobs, setJobs] = useState<AdminJob[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const reload = () => setReloadKey((k) => k + 1);

  const [deleteTarget, setDeleteTarget] = useState<AdminJob | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    api
      .get<AdminJob[]>('/api/admin/jobs' + qs({ keyword, status, audit_status: auditStatus, page, pageSize }))
      .then((r) => {
        if (r.ok) {
          setJobs(r.data);
          setTotal(Number(r.meta?.total) || 0);
        }
        setLoading(false);
      });
  }, [keyword, status, auditStatus, page, reloadKey]);

  if (guarding) return <PageLoading />;

  const applyFilter = () => {
    const params = new URLSearchParams(sp.toString());
    if (kwInput) params.set('keyword', kwInput);
    else params.delete('keyword');
    if (statusInput) params.set('status', statusInput);
    else params.delete('status');
    if (auditInput) params.set('audit_status', auditInput);
    else params.delete('audit_status');
    params.delete('page');
    router.replace(`/adminli/jobs${params.toString() ? `?${params}` : ''}`);
  };

  /**
   * 职位操作。
   * 注意：后端契约（/api/admin/jobs/[id] PUT）以 action 驱动：
   *   approve → 审核通过并上线；reject → 驳回并下线；
   *   offline → 下架；restore → 重新上线；boost/forced → 置顶/加权（JobBoost）。
   */
  const act = async (j: AdminJob, body: Record<string, unknown>, okMsg: string) => {
    const res = await api.put(`/api/admin/jobs/${j.id}`, body);
    if (!res.ok) {
      toast('error', res.error?.message || '操作失败');
      return;
    }
    toast('success', okMsg);
    reload();
  };

  const removeJob = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    const res = await api.del(`/api/admin/jobs/${deleteTarget.id}`);
    setDeleteLoading(false);
    if (!res.ok) {
      toast('error', res.error?.message || '删除失败');
      setDeleteTarget(null);
      return;
    }
    toast('success', '职位已删除');
    setDeleteTarget(null);
    reload();
  };

  return (
    <DashboardShell nav={ADMIN_NAV} title="管理后台" sub="职位管理">
      <h1 className="mb-5 text-xl font-semibold text-text">职位管理（{total}）</h1>

      <Card className="mb-4 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-full sm:w-56">
            <Input
              label="搜索"
              placeholder="职位名称 / 企业名称"
              value={kwInput}
              onChange={(e) => setKwInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && applyFilter()}
            />
          </div>
          <div className="w-full sm:w-36">
            <Select label="状态" options={STATUS_OPTIONS} value={statusInput} onChange={(e) => setStatusInput(e.target.value)} />
          </div>
          <div className="w-full sm:w-36">
            <Select label="审核状态" options={AUDIT_OPTIONS} value={auditInput} onChange={(e) => setAuditInput(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <Button onClick={applyFilter}>搜索</Button>
            <Button
              variant="ghost"
              onClick={() => {
                setKwInput('');
                setStatusInput('');
                setAuditInput('');
                router.replace('/adminli/jobs');
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
        ) : jobs.length === 0 ? (
          <Empty title="暂无职位" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-bg-subtle text-xs text-text-secondary">
                  <th className="px-3 py-3 font-medium">职位标题</th>
                  <th className="px-3 py-3 font-medium">企业</th>
                  <th className="px-3 py-3 font-medium">城市</th>
                  <th className="px-3 py-3 font-medium">薪资</th>
                  <th className="px-3 py-3 font-medium">状态</th>
                  <th className="px-3 py-3 font-medium">审核</th>
                  <th className="px-3 py-3 font-medium">浏览</th>
                  <th className="px-3 py-3 font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((j) => (
                  <tr key={j.id} className="border-b border-border/60 last:border-0 hover:bg-bg-subtle/60">
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-text">{j.title}</span>
                        {j.is_featured && <Badge tone="warning">置顶</Badge>}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-text-secondary">{j.company?.name || '-'}</td>
                    <td className="px-3 py-2.5 text-text-secondary">{j.city || '-'}</td>
                    <td className="px-3 py-2.5 text-text">{formatSalary(j.salary_min, j.salary_max, j.salary_unit)}</td>
                    <td className="px-3 py-2.5">
                      <Badge tone={j.status === 'OPEN' ? 'success' : 'neutral'}>{JOB_STATUS_LABEL[j.status] || j.status}</Badge>
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge tone={j.audit_status === 'APPROVED' ? 'success' : j.audit_status === 'REJECTED' ? 'danger' : 'warning'}>
                        {AUDIT_STATUS_LABEL[j.audit_status] || j.audit_status}
                      </Badge>
                    </td>
                    <td className="px-3 py-2.5 text-text-secondary">{j.views ?? 0}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex flex-wrap gap-1.5">
                        {j.audit_status === 'PENDING' && (
                          <>
                            <Button variant="secondary" size="sm" onClick={() => act(j, { action: 'approve' }, '审核已通过，职位已上线')}>
                              审核通过
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => act(j, { action: 'reject' }, '已驳回该职位')}>
                              驳回
                            </Button>
                          </>
                        )}
                        {j.status === 'OPEN' ? (
                          <Button variant="ghost" size="sm" onClick={() => act(j, { action: 'offline' }, '职位已下架')}>
                            下架
                          </Button>
                        ) : (
                          <Button variant="secondary" size="sm" onClick={() => act(j, { action: 'restore' }, '职位已重新上架')}>
                            上架
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" onClick={() => act(j, { boost: 1 }, '职位已置顶')}>
                          置顶
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(j)}>
                          删除
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

      <ConfirmDialog
        open={!!deleteTarget}
        title="删除职位"
        message={`确定删除「${deleteTarget?.title || ''}」吗？删除后不可恢复。`}
        confirmText="删除"
        onConfirm={removeJob}
        onCancel={() => setDeleteTarget(null)}
        loading={deleteLoading}
      />
    </DashboardShell>
  );
}

export default function AdminJobsPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <JobsContent />
    </Suspense>
  );
}
