'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { CompanyShell } from '@/components/company/CompanyShell';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Empty } from '@/components/ui/Empty';
import { Modal } from '@/components/ui/Modal';
import { Pagination } from '@/components/ui/Pagination';
import { PageLoading } from '@/components/ui/Spinner';
import { useRoleGuard } from '@/lib/route-guard';
import { api, qs } from '@/lib/api';
import { useMyCompanies } from '@/lib/company';
import { formatDate } from '@/lib/utils';

interface HourlyJob {
  id: string;
  title: string;
  city: string;
  hourly_rate?: number | string | null;
  work_period?: string | null;
  slots: number;
  applied_count: number;
  status: string;
  created_at: string;
  hourly_applications?: { status: string }[];
}

interface Applicant {
  id: string;
  status: string;
  created_at: string;
  user: { id: string; name: string; avatar?: string | null; title?: string | null; city?: string | null };
}

function CompanyHourlyJobsContent() {
  const guarding = useRoleGuard(['COMPANY', 'CANDIDATE'], '/');
  const router = useRouter();
  const sp = useSearchParams();
  const { current } = useMyCompanies();

  const page = Number(sp.get('page')) || 1;
  const pageSize = 10;

  const [jobs, setJobs] = useState<HourlyJob[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const [viewJob, setViewJob] = useState<HourlyJob | null>(null);
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [appLoading, setAppLoading] = useState(false);

  const companyId = current?.company.id;

  useEffect(() => {
    if (!companyId) return;
    setLoading(true);
    api
      .get<HourlyJob[]>(`/api/companies/${companyId}/jobs` + qs({ is_hourly: 'true', page, pageSize }))
      .then((r) => {
        if (r.ok) {
          setJobs(r.data);
          setTotal(Number(r.meta?.total) || 0);
        }
        setLoading(false);
      });
  }, [companyId, page]);

  if (guarding) return <PageLoading />;

  const viewApplicants = async (job: HourlyJob) => {
    setViewJob(job);
    setApplicants([]);
    setAppLoading(true);
    const res = await api.get<Applicant[]>(`/api/jobs/${job.id}/applicants`);
    setAppLoading(false);
    if (res.ok) setApplicants(res.data);
  };

  const applicantCount = (j: HourlyJob) => j.hourly_applications?.filter((a) => a.status === 'APPLIED').length ?? j.applied_count ?? 0;

  return (
    <CompanyShell>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold text-text">小时工管理</h1>
        <Link href="/company/jobs/new">
          <Button size="sm">发布小时工</Button>
        </Link>
      </div>

      {loading ? (
        <PageLoading />
      ) : jobs.length === 0 ? (
        <Card>
          <Empty
            title="暂无小时工职位"
            description="发布小时工时勾选「小时工」并填写时薪、工作时段与招聘人数"
            action={<Link href="/company/jobs/new"><Button variant="secondary">去发布</Button></Link>}
          />
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {jobs.map((j) => (
            <Card key={j.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-base font-semibold text-text">{j.title}</span>
                    <Badge tone={j.status === 'OPEN' ? 'success' : 'warning'}>{j.status === 'OPEN' ? '在招' : '已下线'}</Badge>
                    <Badge tone="primary">时薪 ¥{Number(j.hourly_rate ?? 0).toFixed(2)}/小时</Badge>
                  </div>
                  <p className="mt-1 text-sm text-text-secondary">
                    {j.city} · {j.work_period || '工作时段未填写'} · 报名 {applicantCount(j)}/{j.slots} 人
                  </p>
                  <p className="mt-1 text-xs text-text-secondary">发布于 {formatDate(j.created_at)}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Button size="sm" variant="secondary" onClick={() => viewApplicants(j)}>
                    查看报名
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => router.push(`/company/jobs/${j.id}/edit`)}>
                    编辑
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
      <Pagination page={page} pageSize={pageSize} total={total} />

      {/* 报名记录 */}
      <Modal
        open={!!viewJob}
        title={`报名记录：${viewJob?.title || ''}`}
        onClose={() => setViewJob(null)}
        width="max-w-2xl"
      >
        {appLoading ? (
          <PageLoading />
        ) : applicants.length === 0 ? (
          <Empty title="暂无报名" />
        ) : (
          <div className="flex flex-col gap-2">
            {applicants.map((a) => (
              <div key={a.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
                <div className="flex items-center gap-2.5">
                  {a.user.avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={a.user.avatar} alt="" className="h-8 w-8 rounded-full object-cover" />
                  ) : (
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-soft text-xs font-bold text-text">
                      {(a.user.name || '?').slice(0, 1)}
                    </span>
                  )}
                  <div>
                    <p className="text-sm font-medium text-text">{a.user.name}</p>
                    <p className="text-xs text-text-secondary">
                      {[a.user.title, a.user.city].filter(Boolean).join(' · ') || '—'}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <Badge tone={a.status === 'APPLIED' ? 'success' : 'neutral'}>
                    {a.status === 'APPLIED' ? '已报名' : '已取消'}
                  </Badge>
                  <p className="mt-1 text-xs text-text-secondary">{formatDate(a.created_at)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </CompanyShell>
  );
}

export default function CompanyHourlyJobsPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <CompanyHourlyJobsContent />
    </Suspense>
  );
}
