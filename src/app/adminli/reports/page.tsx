'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Empty } from '@/components/ui/Empty';
import { Pagination } from '@/components/ui/Pagination';
import { PageLoading } from '@/components/ui/Spinner';
import { Select } from '@/components/ui/Select';
import { useToast } from '@/components/ui/Toast';
import { useRoleGuard } from '@/lib/route-guard';
import { api, qs } from '@/lib/api';
import { REPORT_STATUS_LABEL, formatDateTime } from '@/lib/utils';
import { ADMIN_NAV } from '@/lib/admin-nav';

interface AdminReport {
  id: string;
  reporter: { id: string; name: string; phone: string };
  target_type: string;
  target_id: string;
  reason: string;
  status: string;
  created_at?: string;
}

const STATUS_OPTIONS = [
  { value: '', label: '全部状态' },
  { value: 'PENDING', label: '待处理' },
  { value: 'HANDLED', label: '已处理' },
  { value: 'DISMISSED', label: '已驳回' },
];

const STATUS_TONE: Record<string, 'warning' | 'success' | 'default'> = {
  PENDING: 'warning',
  HANDLED: 'success',
  DISMISSED: 'default',
};

function ReportsContent() {
  const guarding = useRoleGuard(['ADMIN'], '/');
  const router = useRouter();
  const sp = useSearchParams();
  const { toast } = useToast();

  const page = Number(sp.get('page')) || 1;
  const pageSize = 10;
  const status = sp.get('status') || '';
  const [statusInput, setStatusInput] = useState(status);

  const [reports, setReports] = useState<AdminReport[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [busyId, setBusyId] = useState<string | null>(null);
  const reload = () => setReloadKey((k) => k + 1);

  useEffect(() => {
    setLoading(true);
    api
      .get<AdminReport[]>('/api/admin/reports' + qs({ status, page, pageSize }))
      .then((r) => {
        if (r.ok) {
          setReports(r.data);
          setTotal(Number(r.meta?.total) || 0);
        }
        setLoading(false);
      });
  }, [status, page, reloadKey]);

  if (guarding) return <PageLoading />;

  const applyFilter = () => {
    const params = new URLSearchParams(sp.toString());
    if (statusInput) params.set('status', statusInput);
    else params.delete('status');
    params.delete('page');
    router.replace(`/adminli/reports${params.toString() ? `?${params}` : ''}`);
  };

  const handleReport = async (report: AdminReport, next: 'HANDLED' | 'DISMISSED') => {
    setBusyId(report.id);
    const res = await api.put(`/api/admin/reports/${report.id}`, { status: next });
    setBusyId(null);
    if (!res.ok) {
      toast('error', res.error?.message || '操作失败');
      return;
    }
    toast('success', next === 'HANDLED' ? '举报已标记为已处理' : '举报已驳回');
    reload();
  };

  return (
    <DashboardShell nav={ADMIN_NAV} title="管理后台" sub="举报中心">
      <h1 className="mb-5 text-xl font-semibold text-text">举报中心（{total}）</h1>

      <Card className="mb-4 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-full sm:w-44">
            <Select label="状态" options={STATUS_OPTIONS} value={statusInput} onChange={(e) => setStatusInput(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <Button onClick={applyFilter}>搜索</Button>
            <Button
              variant="ghost"
              onClick={() => {
                setStatusInput('');
                router.replace('/adminli/reports');
              }}
            >
              重置
            </Button>
          </div>
        </div>
      </Card>

      {loading ? (
        <PageLoading />
      ) : reports.length === 0 ? (
        <Empty title="暂无举报" description="当前筛选条件下没有举报记录" />
      ) : (
        <div className="space-y-3">
          {reports.map((r) => (
            <Card key={r.id}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={STATUS_TONE[r.status] || 'default'}>{REPORT_STATUS_LABEL[r.status] || r.status}</Badge>
                  <span className="text-sm font-medium text-text">{r.reporter.name}</span>
                  <span className="text-xs text-text-secondary">{r.reporter.phone}</span>
                </div>
                <span className="text-xs text-text-secondary">{formatDateTime(r.created_at)}</span>
              </div>
              <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-sm">
                <span className="text-text-secondary">举报对象</span>
                <Badge tone="neutral">{r.target_type}</Badge>
                <span className="break-all font-mono text-xs text-text-secondary">#{r.target_id}</span>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-text-secondary">举报理由：{r.reason}</p>
              {r.status === 'PENDING' && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" variant="secondary" loading={busyId === r.id} onClick={() => handleReport(r, 'HANDLED')}>
                    标记已处理
                  </Button>
                  <Button size="sm" variant="ghost" loading={busyId === r.id} onClick={() => handleReport(r, 'DISMISSED')}>
                    驳回
                  </Button>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      <Pagination page={page} pageSize={pageSize} total={total} />
    </DashboardShell>
  );
}

export default function AdminReportsPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <ReportsContent />
    </Suspense>
  );
}
