'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { CandidateShell } from '@/components/layout/CandidateShell';
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
import { formatDate, JOB_TYPE_LABEL } from '@/lib/utils';

interface HourlyApp {
  id: string;
  status: string; // APPLIED | CANCELLED
  created_at: string;
  job: {
    id: string;
    title: string;
    city: string;
    hourly_rate?: number | string | null;
    work_period?: string | null;
    slots: number;
    applied_count: number;
    status: string;
    job_type?: string | null;
    company: { id: string; name: string; logo?: string | null };
  };
}

const STATUS_OPTIONS = [
  { value: '', label: '全部状态' },
  { value: 'APPLIED', label: '已报名' },
  { value: 'CANCELLED', label: '已取消' },
];

function MyHourlyJobsContent() {
  const guarding = useRoleGuard(['CANDIDATE'], '/');
  const router = useRouter();
  const sp = useSearchParams();
  const { toast } = useToast();

  const page = Number(sp.get('page')) || 1;
  const pageSize = 10;
  const status = sp.get('status') || '';
  const [statusInput, setStatusInput] = useState(status);

  const [items, setItems] = useState<HourlyApp[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    api
      .get<HourlyApp[]>('/api/me/hourly-applications' + qs({ status: status || undefined, page, pageSize }))
      .then((r) => {
        if (r.ok) {
          setItems(r.data);
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
    router.replace(`/candidate/hourly-jobs${params.toString() ? `?${params}` : ''}`);
  };

  const cancel = async (app: HourlyApp) => {
    setBusyId(app.id);
    const res = await api.del(`/api/jobs/${app.job.id}/apply`);
    setBusyId(null);
    if (!res.ok) return toast('error', res.error?.message || '取消报名失败');
    toast('success', '已取消报名');
    setReloadKey((k) => k + 1);
  };

  return (
    <CandidateShell sub="我的小时工">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="w-full sm:w-48">
          <Select value={statusInput} onChange={(e) => setStatusInput(e.target.value)} options={STATUS_OPTIONS} />
        </div>
        <Button variant="secondary" onClick={applyFilter}>
          筛选
        </Button>
        <Link href="/hourly-jobs" className="ml-auto">
          <Button variant="ghost">浏览小时工职位</Button>
        </Link>
      </div>

      {loading ? (
        <PageLoading />
      ) : items.length === 0 ? (
        <Card>
          <Empty title="暂无报名记录" description="去浏览小时工职位并报名，报名后记录会显示在这里" action={<Link href="/hourly-jobs"><Button variant="secondary">去报名</Button></Link>} />
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((app) => (
            <Card key={app.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/jobs/${app.job.id}`} className="text-base font-semibold text-text hover:text-primary">
                      {app.job.title}
                    </Link>
                    <Badge tone={app.status === 'APPLIED' ? 'success' : 'neutral'}>
                      {app.status === 'APPLIED' ? '已报名' : '已取消'}
                    </Badge>
                    {app.job.status !== 'OPEN' && <Badge tone="warning">已下线</Badge>}
                  </div>
                  <p className="mt-1 text-sm text-text-secondary">
                    {app.job.company?.name} · {app.job.city}
                    {app.job.job_type ? ` · ${JOB_TYPE_LABEL[app.job.job_type] || app.job.job_type}` : ''}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-text-secondary">
                    <Badge tone="primary">时薪 ¥{Number(app.job.hourly_rate ?? 0).toFixed(2)}/小时</Badge>
                    {app.job.work_period && <Badge tone="neutral">{app.job.work_period}</Badge>}
                    <Badge tone="neutral">已报名 {app.job.applied_count}/{app.job.slots} 人</Badge>
                  </div>
                  <p className="mt-2 text-xs text-text-secondary">报名时间：{formatDate(app.created_at)}</p>
                </div>
                <div className="shrink-0">
                  {app.status === 'APPLIED' && (
                    <Button size="sm" variant="ghost" loading={busyId === app.id} onClick={() => cancel(app)}>
                      取消报名
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
      <Pagination page={page} pageSize={pageSize} total={total} />
    </CandidateShell>
  );
}

export default function MyHourlyJobsPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <MyHourlyJobsContent />
    </Suspense>
  );
}
