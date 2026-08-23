'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { CompanyShell, CompanyGuard } from '@/components/company/CompanyShell';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/Modal';
import { Empty } from '@/components/ui/Empty';
import { Pagination } from '@/components/ui/Pagination';
import { PageLoading } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import { useRoleGuard } from '@/lib/route-guard';
import { api, qs } from '@/lib/api';
import { useMyCompanies, type JobItem, CLOSED_REASON_LABEL } from '@/lib/company';
import { JOB_STATUS_LABEL, AUDIT_STATUS_LABEL, formatSalary, formatDate, JOB_TYPE_LABEL } from '@/lib/utils';

function JobsContent() {
  const guarding = useRoleGuard(['COMPANY', 'CANDIDATE'], '/');
  const router = useRouter();
  const sp = useSearchParams();
  const { toast } = useToast();
  const { current } = useMyCompanies();

  const page = Number(sp.get('page')) || 1;
  const pageSize = 10;

  const [jobs, setJobs] = useState<JobItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState<JobItem | null>(null);
  const [removingLoading, setRemovingLoading] = useState(false);

  const companyId = current?.company.id;

  useEffect(() => {
    if (!companyId) return;
    setLoading(true);
    api
      .get<JobItem[]>(`/api/companies/${companyId}/jobs` + qs({ page, pageSize }))
      .then((r) => {
        if (r.ok) {
          setJobs(r.data);
          setTotal(Number(r.meta?.total) || 0);
        }
        setLoading(false);
      });
  }, [companyId, page]);

  if (guarding) return <PageLoading />;

  const act = async (fn: () => Promise<{ ok: boolean; data?: unknown; error?: { error?: string; message?: string } }>, okMsg: string, failMsg: string) => {
    const res = await fn();
    if (!res.ok) {
      if (res.error?.error === 'JOB_LIMIT_EXCEEDED') toast('error', `${res.error.message}，可在「会员与账单」升级套餐`);
      else if (res.error?.error === 'FEATURE_NOT_ALLOWED') toast('error', '当前套餐不支持置顶，可在「会员与账单」升级套餐');
      else toast('error', res.error?.message || failMsg);
      return;
    }
    toast('success', okMsg);
    router.replace(`/company/jobs${page > 1 ? `?page=${page}` : ''}`);
  };

  const close = (j: JobItem) =>
    act(async () => api.post(`/api/jobs/${j.id}/close`), '职位已下线', '下线失败');
  const reopen = (j: JobItem) =>
    act(async () => {
      const res = await api.post<{ status: string }>(`/api/jobs/${j.id}/reopen`);
      return res;
    }, '职位已重新上线', '重开失败');
  const feature = (j: JobItem) =>
    act(async () => api.post(`/api/jobs/${j.id}/feature`), '职位已置顶', '置顶失败');

  const remove = async () => {
    if (!removing) return;
    setRemovingLoading(true);
    const res = await api.del(`/api/jobs/${removing.id}`);
    setRemovingLoading(false);
    if (!res.ok) {
      toast('error', res.error?.message || '删除失败');
      setRemoving(null);
      return;
    }
    toast('success', '职位已删除');
    setRemoving(null);
    router.replace(`/company/jobs${page > 1 ? `?page=${page}` : ''}`);
  };

  return (
    <CompanyShell>
      <CompanyGuard>
        <div className="mb-4 flex items-center justify-between gap-2">
          <h1 className="text-lg font-bold text-text">职位管理（{total}）</h1>
          <Link href="/company/jobs/new">
            <Button size="sm">发布职位</Button>
          </Link>
        </div>

        {loading ? (
          <PageLoading />
        ) : jobs.length === 0 ? (
          <Empty title="还没有职位" description="发布第一个职位，开始招人吧" action={<Link href="/company/jobs/new"><Button size="sm">立即发布</Button></Link>} />
        ) : (
          <div className="flex flex-col gap-3">
            {jobs.map((j) => (
              <Card key={j.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-semibold text-text">{j.title}</h3>
                      {j.is_featured && <Badge tone="warning">置顶</Badge>}
                      <Badge tone={j.status === 'OPEN' ? 'success' : 'neutral'}>{JOB_STATUS_LABEL[j.status] || j.status}</Badge>
                      {j.audit_status !== 'APPROVED' && (
                        <Badge tone={j.audit_status === 'PENDING' ? 'warning' : 'danger'}>
                          {AUDIT_STATUS_LABEL[j.audit_status] || j.audit_status}
                        </Badge>
                      )}
                      {j.closed_reason && <Badge tone="neutral">{CLOSED_REASON_LABEL[j.closed_reason] || j.closed_reason}</Badge>}
                    </div>
                    <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-text-secondary">
                      <span className="font-semibold text-text">{formatSalary(j.salary_min, j.salary_max, j.salary_unit)}</span>
                      {j.city && <span>{j.city}</span>}
                      {j.job_type && <span>{JOB_TYPE_LABEL[j.job_type] || j.job_type}</span>}
                      {j.views != null && <span>{j.views} 浏览</span>}
                      <span>{formatDate(j.created_at)}</span>
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <Link href={`/company/jobs/${j.id}/edit`}>
                      <Button variant="secondary" size="sm">编辑</Button>
                    </Link>
                    {j.status === 'OPEN' ? (
                      <>
                        <Button variant="ghost" size="sm" onClick={() => close(j)}>下架</Button>
                        {!j.is_featured && (
                          <Button variant="ghost" size="sm" onClick={() => feature(j)}>置顶</Button>
                        )}
                      </>
                    ) : j.closed_reason === 'QUOTA_EXCEEDED' ? (
                      <Link href={`/company/jobs/${j.id}/restore`}>
                        <Button variant="secondary" size="sm">恢复</Button>
                      </Link>
                    ) : (
                      <Button variant="ghost" size="sm" onClick={() => reopen(j)}>重开</Button>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => setRemoving(j)}>删除</Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        <Pagination page={page} pageSize={pageSize} total={total} />

        <ConfirmDialog
          open={!!removing}
          title="删除职位"
          message={`确定删除「${removing?.title || ''}」吗？删除后不可恢复。`}
          onConfirm={remove}
          onCancel={() => setRemoving(null)}
          confirmText="删除"
          loading={removingLoading}
        />
      </CompanyGuard>
    </CompanyShell>
  );
}

export default function CompanyJobsPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <JobsContent />
    </Suspense>
  );
}
