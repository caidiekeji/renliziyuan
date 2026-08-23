'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { PublicHeader, PublicFooter } from '@/components/layout/PublicLayout';
import { JobCard, type JobCardData } from '@/components/JobCard';
import { api, qs } from '@/lib/api';
import { PageLoading } from '@/components/ui/Spinner';
import { Pagination } from '@/components/ui/Pagination';
import { Empty } from '@/components/ui/Empty';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/lib/auth-context';

const HOT_CITIES = ['北京', '上海', '广州', '深圳', '杭州', '成都', '武汉', '南京', '西安', '苏州'];

function HourlyJobsContent() {
  const router = useRouter();
  const sp = useSearchParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const city = sp.get('city') || '';
  const sort = sp.get('sort') || 'latest';
  const page = Number(sp.get('page')) || 1;
  const pageSize = 12;

  const [jobs, setJobs] = useState<JobCardData[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [mine, setMine] = useState<Record<string, string>>({}); // job_id -> APPLIED | CANCELLED
  const [busyId, setBusyId] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    setLoading(true);
    api
      .get<JobCardData[]>('/api/jobs' + qs({ is_hourly: true, city: city || undefined, sort: sort || undefined, page, pageSize }))
      .then((r) => {
        if (r.ok) {
          setJobs(r.data);
          setTotal(Number(r.meta?.total) || 0);
        }
        setLoading(false);
      });
  }, [city, sort, page, reloadKey]);

  // 求职者已报名状态（供按钮展示：已报名/可报名）
  useEffect(() => {
    if (user?.role !== 'CANDIDATE') return;
    api.get<any[]>('/api/me/hourly-applications?pageSize=100').then((r) => {
      if (!r.ok) return;
      const map: Record<string, string> = {};
      r.data.forEach((a) => {
        if (a.job_id) map[a.job_id] = a.status;
      });
      setMine(map);
    });
  }, [user?.role, reloadKey]);

  const setParam = (k: string, v: string) => {
    const params = new URLSearchParams(sp.toString());
    if (!v) params.delete(k);
    else params.set(k, v);
    params.delete('page');
    router.push(`/hourly-jobs?${params.toString()}`);
  };

  const apply = async (jobId: string) => {
    if (!user) return router.push('/login');
    setBusyId(jobId);
    const res = await api.post(`/api/jobs/${jobId}/apply`);
    setBusyId(null);
    if (!res.ok) return toast('error', res.error?.message || '报名失败');
    toast('success', '报名成功');
    setReloadKey((k) => k + 1);
  };

  const cancel = async (jobId: string) => {
    setBusyId(jobId);
    const res = await api.del(`/api/jobs/${jobId}/apply`);
    setBusyId(null);
    if (!res.ok) return toast('error', res.error?.message || '取消报名失败');
    toast('success', '已取消报名');
    setReloadKey((k) => k + 1);
  };

  return (
    <div className="min-h-screen bg-bg">
      <PublicHeader />
      <div className="mx-auto max-w-6xl px-4 py-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-bold text-text">小时工</h1>
          <div className="flex items-center gap-2">
            <Select value={city} onChange={(e) => setParam('city', e.target.value)} className="w-32">
              <option value="">全部城市</option>
              {HOT_CITIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
            <Select value={sort} onChange={(e) => setParam('sort', e.target.value)} className="w-32">
              <option value="latest">最新发布</option>
              <option value="hot">最热</option>
              <option value="salary_desc">时薪从高到低</option>
              <option value="salary_asc">时薪从低到高</option>
            </Select>
          </div>
        </div>

        {loading ? (
          <PageLoading />
        ) : jobs.length === 0 ? (
          <Empty title="暂无小时工职位" description="换个城市或稍后再来看看" />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {jobs.map((j) => {
              const st = mine[j.id];
              const full = j.slots != null && (j.applied_count ?? 0) >= j.slots;
              const closed = j.status !== 'OPEN';
              return (
                <JobCard
                  key={j.id}
                  job={j}
                  action={
                    st === 'APPLIED' ? (
                      <Button size="sm" variant="ghost" loading={busyId === j.id} onClick={() => cancel(j.id)}>
                        取消报名
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant={full || closed ? 'secondary' : 'primary'}
                        disabled={full || closed}
                        loading={busyId === j.id}
                        onClick={() => apply(j.id)}
                      >
                        {closed ? '已下线' : full ? '名额已满' : '报名'}
                      </Button>
                    )
                  }
                />
              );
            })}
          </div>
        )}
        <Pagination page={page} pageSize={pageSize} total={total} />
      </div>
      <PublicFooter />
    </div>
  );
}

export default function HourlyJobsPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <HourlyJobsContent />
    </Suspense>
  );
}
