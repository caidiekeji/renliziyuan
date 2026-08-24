'use client';

import { Suspense, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { PublicHeader, PublicFooter } from '@/components/layout/PublicLayout';
import { api } from '@/lib/api';
import { PageLoading } from '@/components/ui/Spinner';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Rating } from '@/components/ui/Rating';
import { PhoneButton } from '@/components/ui/PhoneButton';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/lib/auth-context';
import { formatSalary, JOB_TYPE_LABEL, EXPERIENCE_LABEL, timeAgo } from '@/lib/utils';
import type { JobCardData } from '@/components/JobCard';

interface JobDetail extends JobCardData {
  description?: string;
  requirements?: string;
  tags?: string[];
  education?: string | null;
  location?: string | null;
  lat?: number | null;
  lng?: number | null;
  company?: { id: string; name: string; logo?: string | null; verify_status?: string; avg_rating?: number | null; review_count?: number };
}

function JobDetailContent() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const uid = user?.id;
  const [job, setJob] = useState<JobDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [favorited, setFavorited] = useState(false);
  const [chatting, setChatting] = useState(false);
  const [applied, setApplied] = useState(false); // 小时工已报名
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    setLoading(true);
    const favsPromise = uid ? api.get<any[]>('/api/me/favorites?pageSize=50').catch(() => null) : Promise.resolve(null);
    const minePromise = uid ? api.get<any[]>('/api/me/hourly-applications?pageSize=100').catch(() => null) : Promise.resolve(null);
    Promise.all([api.get<JobDetail>(`/api/jobs/${id}`), favsPromise, minePromise]).then(([j, favs, mine]) => {
      if (j.ok) setJob(j.data);
      if (favs?.ok) setFavorited(favs.data.some((f: any) => f.job?.id === id));
      if (mine?.ok) setApplied(mine.data.some((a: any) => a.job_id === id && a.status === 'APPLIED'));
      setLoading(false);
    });
  }, [id, uid]);

  const apply = async () => {
    if (!user) return router.push('/login');
    setApplying(true);
    const res = await api.post(`/api/jobs/${id}/apply`);
    setApplying(false);
    if (!res.ok) return toast('error', res.error?.message || '报名失败');
    setApplied(true);
    toast('success', '报名成功');
  };

  const cancelApply = async () => {
    setApplying(true);
    const res = await api.del(`/api/jobs/${id}/apply`);
    setApplying(false);
    if (!res.ok) return toast('error', res.error?.message || '取消报名失败');
    setApplied(false);
    toast('success', '已取消报名');
  };

  const startChat = async () => {
    if (!user) {
      router.push('/login');
      return;
    }
    setChatting(true);
    const res = await api.post<{ id: string }>('/api/conversations', { job_id: id });
    setChatting(false);
    if (res.ok) {
      if (user.role === 'CANDIDATE') router.push(`/candidate/messages/${res.data.id}`);
      else toast('info', '请以求职者身份进入会话');
    } else {
      toast('error', res.error?.message || '发起沟通失败');
    }
  };

  const toggleFavorite = async () => {
    if (!user) {
      router.push('/login');
      return;
    }
    const res = favorited
      ? await api.del(`/api/me/favorites/${id}`)
      : await api.post(`/api/me/favorites/${id}`);
    if (res.ok) {
      setFavorited(!favorited);
      toast('success', favorited ? '已取消收藏' : '已收藏');
    }
  };

  if (loading || authLoading) return <PageLoading />;
  if (!job)
    return (
      <div className="min-h-screen bg-bg">
        <PublicHeader />
        <div className="mx-auto max-w-3xl py-24 text-center text-text-secondary">职位不存在或已下线</div>
        <PublicFooter />
      </div>
    );

  const company = job.company;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'JobPosting',
    title: job.title,
    description: job.description || '',
    datePosted: job.created_at,
    hiringOrganization: { '@type': 'Organization', name: company?.name || '' },
    jobLocation: {
      '@type': 'Place',
      address: { '@type': 'PostalAddress', addressLocality: job.city || '' },
    },
    employmentType: job.job_type ? JOB_TYPE_LABEL[job.job_type] : undefined,
    ...(job.salary_min != null
      ? { baseSalary: { '@type': 'MonetaryAmount', value: Number(job.salary_min), currency: 'CNY' } }
      : {}),
  };

  return (
    <div className="min-h-screen bg-bg">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <PublicHeader />
      <div className="mx-auto max-w-6xl px-4 py-6">
        <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
          {/* 主内容 */}
          <div className="space-y-5">
            <div className="card p-5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-xl font-bold text-text sm:text-2xl">{job.title}</h1>
                    {job.is_featured && <Badge tone="warning">置顶</Badge>}
                    {job.job_title?.category && <Badge tone="primary">{job.job_title.category}</Badge>}
                  </div>
                  <p className="mt-2 text-2xl font-bold text-text">
                    {job.is_hourly ? `¥${Number(job.hourly_rate ?? 0)}/小时` : formatSalary(job.salary_min, job.salary_max, job.salary_unit)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={toggleFavorite}>
                    {favorited ? '已收藏' : '收藏'}
                  </Button>
                  {job.is_hourly ? (
                    applied ? (
                      <Button variant="secondary" loading={applying} onClick={cancelApply}>
                        取消报名
                      </Button>
                    ) : (
                      <Button loading={applying} onClick={apply}>
                        {applying ? '报名中…' : '报名'}
                      </Button>
                    )
                  ) : (
                    <Button onClick={startChat} loading={chatting}>
                      {chatting ? '发起中…' : '发起沟通'}
                    </Button>
                  )}
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-1.5">
                {job.is_hourly && <Badge tone="success">小时工</Badge>}
                {job.city && <Badge tone="neutral">{job.city}</Badge>}
                {job.job_type && <Badge tone="neutral">{JOB_TYPE_LABEL[job.job_type] || job.job_type}</Badge>}
                {job.is_hourly && job.work_period && <Badge tone="neutral">{job.work_period}</Badge>}
                {job.is_hourly && job.slots != null && <Badge tone="neutral">已报名 {job.applied_count ?? 0}/{job.slots} 人</Badge>}
                {job.experience && <Badge tone="neutral">{EXPERIENCE_LABEL[job.experience] || job.experience}</Badge>}
                {job.education && <Badge tone="neutral">{job.education}</Badge>}
                {job.location && <Badge tone="neutral">{job.location}</Badge>}
                {job.tags?.map((t) => (
                  <Badge key={t} tone="primary">
                    {t}
                  </Badge>
                ))}
              </div>

              <div className="mt-5 border-t border-border pt-5">
                <h2 className="mb-2 text-sm font-semibold text-text">职位描述</h2>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-text-secondary">{job.description || '暂无描述'}</p>
                {job.requirements && (
                  <>
                    <h2 className="mb-2 mt-5 text-sm font-semibold text-text">任职要求</h2>
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-text-secondary">{job.requirements}</p>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* 侧栏 */}
          <div className="space-y-4">
            <div className="card p-5">
              <div className="flex items-center gap-3">
                {company?.logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={company.logo} alt="" className="h-12 w-12 rounded-lg object-cover" />
                ) : (
                  <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary-soft text-lg font-bold text-text">
                    {(company?.name || '企').slice(0, 1)}
                  </span>
                )}
                <div className="min-w-0">
                  <button onClick={() => router.push(`/companies/${company?.id}`)} className="block truncate text-sm font-semibold text-text hover:text-text">
                    {company?.name}
                  </button>
                  <div className="mt-0.5 flex items-center gap-1.5">
                    {company?.verify_status === 'VERIFIED' && <Badge tone="success">已认证</Badge>}
                    <Rating value={company?.avg_rating} size={12} />
                    <span className="text-xs text-text-secondary">({company?.review_count || 0})</span>
                  </div>
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                <PhoneButton type="JOB" targetId={job.id} className="flex-1" />
                <Button variant="ghost" onClick={() => router.push(`/companies/${company?.id}`)} className="flex-1">
                  查看企业
                </Button>
              </div>
            </div>

            <div className="card p-5 text-xs text-text-secondary">
              <div className="flex justify-between py-1">
                <span>发布时间</span>
                <span>{timeAgo(job.created_at)}</span>
              </div>
              <div className="flex justify-between py-1">
                <span>浏览量</span>
                <span>{job.views || 0}</span>
              </div>
              {job.industry && (
                <div className="flex justify-between py-1">
                  <span>所属行业</span>
                  <span>{job.industry.name}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 移动端底部操作栏：收藏 + 报名/发起沟通常驻，避免长内容页需滚动回顶部 */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-white px-4 pb-[env(safe-area-inset-bottom)] pt-2 lg:hidden">
        <div className="mx-auto flex max-w-6xl gap-2">
          <Button variant="secondary" className="flex-1" onClick={toggleFavorite}>
            {favorited ? '已收藏' : '收藏'}
          </Button>
          {job.is_hourly ? (
            applied ? (
              <Button variant="secondary" className="flex-1" loading={applying} onClick={cancelApply}>
                取消报名
              </Button>
            ) : (
              <Button className="flex-1" loading={applying} onClick={apply}>
                {applying ? '报名中…' : '报名'}
              </Button>
            )
          ) : (
            <Button className="flex-1" onClick={startChat} loading={chatting}>
              {chatting ? '发起中…' : '发起沟通'}
            </Button>
          )}
        </div>
      </div>
      <div className="pb-20 lg:pb-0">
        <PublicFooter />
      </div>
    </div>
  );
}

export default function JobDetailPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <JobDetailContent />
    </Suspense>
  );
}
