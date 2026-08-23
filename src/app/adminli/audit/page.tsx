'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Empty } from '@/components/ui/Empty';
import { Input } from '@/components/ui/Input';
import { Pagination } from '@/components/ui/Pagination';
import { PageLoading } from '@/components/ui/Spinner';
import { useRoleGuard } from '@/lib/route-guard';
import { api, qs } from '@/lib/api';
import { formatDateTime } from '@/lib/utils';
import { ADMIN_NAV } from '@/lib/admin-nav';

interface AuditLog {
  id: string;
  admin: { id: string; name: string } | null;
  action: string;
  target_type: string;
  target_id: string;
  detail: unknown | null;
  ip: string | null;
  created_at?: string;
}

const DETAIL_MAX = 100;

function AuditContent() {
  const guarding = useRoleGuard(['ADMIN'], '/');
  const router = useRouter();
  const sp = useSearchParams();

  const page = Number(sp.get('page')) || 1;
  const pageSize = 10;
  const action = sp.get('action') || '';
  const adminId = sp.get('admin_id') || '';

  const [actionInput, setActionInput] = useState(action);
  const [adminIdInput, setAdminIdInput] = useState(adminId);

  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api
      .get<AuditLog[]>('/api/admin/audit-logs' + qs({ action, admin_id: adminId, page, pageSize }))
      .then((r) => {
        if (r.ok) {
          setLogs(r.data);
          setTotal(Number(r.meta?.total) || 0);
        }
        setLoading(false);
      });
  }, [action, adminId, page]);

  if (guarding) return <PageLoading />;

  const applyFilter = () => {
    const params = new URLSearchParams(sp.toString());
    if (actionInput) params.set('action', actionInput);
    else params.delete('action');
    if (adminIdInput) params.set('admin_id', adminIdInput);
    else params.delete('admin_id');
    params.delete('page');
    router.replace(`/adminli/audit${params.toString() ? `?${params}` : ''}`);
  };

  const detailText = (d: unknown) => (d == null ? '-' : JSON.stringify(d));
  const detailShown = (d: unknown) => {
    const s = detailText(d);
    return s.length > DETAIL_MAX ? `${s.slice(0, DETAIL_MAX)}…` : s;
  };

  return (
    <DashboardShell nav={ADMIN_NAV} title="管理后台" sub="操作审计">
      <h1 className="mb-4 text-lg font-bold text-text">操作审计（{total}）</h1>

      <Card className="mb-4 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-full sm:w-44">
            <Input
              label="动作类型"
              placeholder="如 HANDLE_REPORT"
              value={actionInput}
              onChange={(e) => setActionInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && applyFilter()}
            />
          </div>
          <div className="w-full sm:w-44">
            <Input
              label="管理员 ID"
              placeholder="按管理员 ID 过滤"
              value={adminIdInput}
              onChange={(e) => setAdminIdInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && applyFilter()}
            />
          </div>
          <div className="flex gap-2">
            <Button onClick={applyFilter}>筛选</Button>
            <Button
              variant="ghost"
              onClick={() => {
                setActionInput('');
                setAdminIdInput('');
                router.replace('/adminli/audit');
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
        ) : logs.length === 0 ? (
          <Empty title="暂无审计日志" description="当前筛选条件下没有操作记录" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-text-secondary">
                  <th className="px-3 py-2 font-medium">操作人</th>
                  <th className="px-3 py-2 font-medium">动作</th>
                  <th className="px-3 py-2 font-medium">对象类型</th>
                  <th className="px-3 py-2 font-medium">对象 ID</th>
                  <th className="px-3 py-2 font-medium">详情</th>
                  <th className="px-3 py-2 font-medium">IP</th>
                  <th className="px-3 py-2 font-medium">时间</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((l) => (
                  <tr key={l.id} className="border-b border-border/60 last:border-0 hover:bg-bg-subtle/60">
                    <td className="px-3 py-2.5 font-medium text-text">{l.admin?.name || '-'}</td>
                    <td className="px-3 py-2.5">
                      <Badge tone="primary">{l.action}</Badge>
                    </td>
                    <td className="px-3 py-2.5 text-text-secondary">{l.target_type}</td>
                    <td className="px-3 py-2.5 font-mono text-xs text-text-secondary">{l.target_id || '-'}</td>
                    <td className="max-w-[260px] px-3 py-2.5">
                      <p className="break-all font-mono text-xs text-text-secondary" title={detailText(l.detail)}>
                        {detailShown(l.detail)}
                      </p>
                    </td>
                    <td className="px-3 py-2.5 text-text-secondary">{l.ip || '-'}</td>
                    <td className="px-3 py-2.5 text-text-secondary">{formatDateTime(l.created_at)}</td>
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
    </DashboardShell>
  );
}

export default function AdminAuditPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <AuditContent />
    </Suspense>
  );
}
