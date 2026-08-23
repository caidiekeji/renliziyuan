'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { ADMIN_NAV } from '@/lib/admin-nav';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Empty } from '@/components/ui/Empty';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Pagination } from '@/components/ui/Pagination';
import { PageLoading } from '@/components/ui/Spinner';
import { Select } from '@/components/ui/Select';
import { useRoleGuard } from '@/lib/route-guard';
import { api, qs } from '@/lib/api';
import { formatDate, formatDateTime } from '@/lib/utils';

interface AdminHourlyJob {
  id: string;
  title: string;
  city: string;
  hourly_rate?: number | string | null;
  work_period?: string | null;
  slots: number;
  applied_count: number;
  status: string;
  created_at: string;
  company: { id: string; name: string };
  hourly_applications?: { status: string }[];
}

interface HourlyStats {
  total_jobs: number;
  total_applied: number;
  total_cancelled: number;
}

interface Applicant {
  id: string;
  status: string;
  created_at: string;
  user: { id: string; name: string; avatar?: string | null; phone?: string | null; title?: string | null; city?: string | null };
}

const STATUS_OPTIONS = [
  { value: '', label: '全部状态' },
  { value: 'OPEN', label: '在招' },
  { value: 'CLOSED', label: '已下线' },
];

function AdminHourlyJobsContent() {
  const guarding = useRoleGuard(['ADMIN'], '/');
  const router = useRouter();
  const sp = useSearchParams();
  const page = Number(sp.get('page')) || 1;
  const pageSize = 10;
  const status = sp.get('status') || '';
  const keyword = sp.get('keyword') || '';
  const [statusInput, setStatusInput] = useState(status);
  const [kwInput, setKwInput] = useState(keyword);

  const [stats, setStats] = useState<HourlyStats | null>(null);
  const [items, setItems] = useState<AdminHourlyJob[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const [viewJob, setViewJob] = useState<AdminHourlyJob | null>(null);
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [appLoading, setAppLoading] = useState(false);

  useEffect(() => {
    api.get<HourlyStats>('/api/admin/hourly-jobs/stats').then((r) => r.ok && setStats(r.data));
  }, []);

  useEffect(() => {
    setLoading(true);
    api
      .get<AdminHourlyJob[]>('/api/admin/hourly-jobs' + qs({ status: status || undefined, keyword: keyword || undefined, page, pageSize }))
      .then((r) => {
        if (r.ok) {
          setItems(r.data);
          setTotal(Number(r.meta?.total) || 0);
        }
        setLoading(false);
      });
  }, [status, keyword, page]);

  if (guarding) return <PageLoading />;

  const applyFilter = () => {
    const params = new URLSearchParams(sp.toString());
    if (statusInput) params.set('status', statusInput);
    else params.delete('status');
    if (kwInput) params.set('keyword', kwInput);
    else params.delete('keyword');
    params.delete('page');
    router.replace(`/adminli/hourly-jobs${params.toString() ? `?${params}` : ''}`);
  };

  const viewApplicants = async (job: AdminHourlyJob) => {
    setViewJob(job);
    setApplicants([]);
    setAppLoading(true);
    const res = await api.get<Applicant[]>(`/api/admin/hourly-jobs/${job.id}/applicants`);
    setAppLoading(false);
    if (res.ok) setApplicants(res.data);
  };

  const applicantCount = (j: AdminHourlyJob) => j.hourly_applications?.filter((a) => a.status === 'APPLIED').length ?? j.applied_count ?? 0;

  return (
    <DashboardShell nav={ADMIN_NAV} title="管理后台" sub="小时工管理">
      {/* 数据概览 */}
      <div className="mb-5 grid grid-cols-3 gap-3">
        <div className="card p-4">
          <p className="text-xs text-text-secondary">小时工职位</p>
          <p className="mt-1 text-xl font-bold text-text">{stats?.total_jobs ?? '-'}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-text-secondary">已报名</p>
          <p className="mt-1 text-xl font-bold text-text">{stats?.total_applied ?? '-'}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-text-secondary">已取消</p>
          <p className="mt-1 text-xl font-bold text-text">{stats?.total_cancelled ?? '-'}</p>
        </div>
      </div>

      {/* 筛选 */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="w-40">
          <Select value={statusInput} onChange={(e) => setStatusInput(e.target.value)} options={STATUS_OPTIONS} />
        </div>
        <Input placeholder="职位/企业关键词" value={kwInput} onChange={(e) => setKwInput(e.target.value)} className="w-56" />
        <Button variant="secondary" onClick={applyFilter}>
          筛选
        </Button>
      </div>

      {loading ? (
        <PageLoading />
      ) : items.length === 0 ? (
        <Card>
          <Empty title="暂无小时工职位" />
        </Card>
      ) : (
        <Card className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-text-secondary">
                  <th className="px-4 py-3 font-medium">职位</th>
                  <th className="px-4 py-3 font-medium">企业</th>
                  <th className="px-4 py-3 font-medium">城市</th>
                  <th className="px-4 py-3 font-medium">时薪</th>
                  <th className="px-4 py-3 font-medium">报名</th>
                  <th className="px-4 py-3 font-medium">状态</th>
                  <th className="px-4 py-3 font-medium">发布时间</th>
                  <th className="px-4 py-3 font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {items.map((j) => (
                  <tr key={j.id} className="border-b border-border/60 last:border-0 hover:bg-bg-subtle">
                    <td className="max-w-48 truncate px-4 py-3 font-medium text-text">{j.title}</td>
                    <td className="max-w-40 truncate px-4 py-3 text-text-secondary">{j.company.name}</td>
                    <td className="px-4 py-3 text-text-secondary">{j.city}</td>
                    <td className="px-4 py-3 text-text">¥{Number(j.hourly_rate ?? 0).toFixed(2)}/时</td>
                    <td className="px-4 py-3 text-text-secondary">
                      {applicantCount(j)}/{j.slots}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={j.status === 'OPEN' ? 'success' : 'warning'}>{j.status === 'OPEN' ? '在招' : '已下线'}</Badge>
                    </td>
                    <td className="px-4 py-3 text-xs text-text-secondary">{formatDate(j.created_at)}</td>
                    <td className="px-4 py-3">
                      <Button size="sm" variant="secondary" onClick={() => viewApplicants(j)}>
                        报名记录
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
      <Pagination page={page} pageSize={pageSize} total={total} />

      {/* 报名记录 */}
      <Modal open={!!viewJob} title={`报名记录：${viewJob?.title || ''}`} onClose={() => setViewJob(null)} width="max-w-2xl">
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
                      {a.user.phone ? `手机 ${a.user.phone.slice(0, 3)}****${a.user.phone.slice(-4)} · ` : ''}
                      {[a.user.title, a.user.city].filter(Boolean).join(' · ') || '—'}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <Badge tone={a.status === 'APPLIED' ? 'success' : 'neutral'}>
                    {a.status === 'APPLIED' ? '已报名' : '已取消'}
                  </Badge>
                  <p className="mt-1 text-xs text-text-secondary">{formatDateTime(a.created_at)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </DashboardShell>
  );
}

export default function AdminHourlyJobsPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <AdminHourlyJobsContent />
    </Suspense>
  );
}
