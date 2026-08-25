'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { CompanyShell } from '@/components/company/CompanyShell';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Rating } from '@/components/ui/Rating';
import { PageLoading } from '@/components/ui/Spinner';
import { useRoleGuard } from '@/lib/route-guard';
import { api, qs } from '@/lib/api';
import { useMyCompanies, type JobItem, type SubscriptionInfo } from '@/lib/company';
import { COMPANY_VERIFY_LABEL, formatDate } from '@/lib/utils';

interface JobStats {
  open: number;
  pending: number;
  closed: number;
}

export default function CompanyHomePage() {
  const guarding = useRoleGuard(['COMPANY', 'CANDIDATE'], '/');
  const router = useRouter();
  const { entries, current, loading } = useMyCompanies();
  const [stats, setStats] = useState<JobStats | null>(null);
  const [subInfo, setSubInfo] = useState<SubscriptionInfo | null>(null);
  const [convTotal, setConvTotal] = useState(0);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    if (loading) return;
    if (entries.length === 0 || !current) {
      router.replace('/company/switch');
      return;
    }
  }, [loading, entries, current, router]);

  const companyId = current?.company.id;

  useEffect(() => {
    if (!companyId) return;
    setDataLoading(true);
    Promise.all([
      api.get<JobItem[]>(`/api/companies/${companyId}/jobs` + qs({ pageSize: 50 })),
      api.get<SubscriptionInfo>('/api/subscriptions'),
      api.get<unknown[]>('/api/conversations' + qs({ pageSize: 1 })),
    ]).then(([j, s, c]) => {
      if (j.ok) {
        const list = j.data;
        setStats({
          open: list.filter((x) => x.status === 'OPEN').length,
          pending: list.filter((x) => x.audit_status === 'PENDING').length,
          closed: list.filter((x) => x.status === 'CLOSED').length,
        });
      }
      if (s.ok) setSubInfo(s.data);
      if (c.ok) setConvTotal(Number(c.meta?.total) || 0);
      setDataLoading(false);
    });
  }, [companyId]);

  if (guarding) return <PageLoading />;
  if (loading || !current) return <PageLoading />;

  const plan = subInfo?.subscription?.plan;
  const jobLimit = plan?.job_limit ?? 3;
  const openJobCount = subInfo?.open_job_count ?? current.open_job_count;

  const entryCards = [
    { href: '/company/jobs', label: '职位管理', desc: '管理在招 / 待审 / 已下线职位', icon: 'job' },
    { href: '/company/jobs/new', label: '发布职位', desc: '发布新的招聘职位', icon: 'send' },
    { href: '/company/messages', label: '消息', desc: '与求职者实时沟通', icon: 'chat' },
    { href: '/company/reviews', label: '评价', desc: '查看求职者评价', icon: 'star' },
    { href: '/company/profile', label: '企业资料', desc: '完善企业信息', icon: 'building' },
    { href: '/company/members', label: '成员管理', desc: '邀请 / 管理团队成员', icon: 'users' },
    { href: '/company/billing', label: '会员与账单', desc: '套餐与支付记录', icon: 'card' },
  ];

  return (
    <CompanyShell>
      {/* 企业信息 + 套餐 */}
      <Card className="p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          {current.company.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={current.company.logo} alt="" className="h-14 w-14 shrink-0 rounded-xl object-cover" />
          ) : (
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-xl font-bold text-text">
              {current.company.name.slice(0, 1)}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold text-text">{current.company.name}</h1>
              <Badge tone={current.company.verify_status === 'VERIFIED' ? 'success' : 'default'}>
                {COMPANY_VERIFY_LABEL[current.company.verify_status] || current.company.verify_status}
              </Badge>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-text-secondary">
              {current.company.industry && <span>行业：{current.company.industry.name}</span>}
              <span className="inline-flex items-center gap-1">
                <Rating value={current.company.avg_rating} size={13} />
                {current.company.review_count ? `${current.company.review_count} 条评价` : '暂无评价'}
              </span>
            </div>
          </div>
          <div className="shrink-0 rounded-lg bg-bg-subtle px-4 py-3 text-sm">
            <p className="font-medium text-text">
              当前套餐：<span className="text-text">{plan?.name || '免费版'}</span>
            </p>
            <p className="mt-1 text-xs text-text-secondary">
              职位名额 {openJobCount} / {jobLimit === 999999 ? '不限' : jobLimit}
              {subInfo?.subscription ? ` · 到期 ${formatDate(subInfo.subscription.end_at)}` : ''}
            </p>
          </div>
        </div>
      </Card>

      {/* 数据概览 */}
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="在招职位" value={dataLoading ? '-' : stats?.open ?? 0} tone="success" />
        <StatCard label="待审核" value={dataLoading ? '-' : stats?.pending ?? 0} tone="warning" />
        <StatCard label="已下线" value={dataLoading ? '-' : stats?.closed ?? 0} tone="neutral" />
        <StatCard label="会话数" value={dataLoading ? '-' : convTotal} tone="primary" />
      </div>

      {/* 功能入口 */}
      <h2 className="mb-3 mt-6 text-base font-bold text-text">快捷入口</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {entryCards.map((c) => (
          <Link key={c.href} href={c.href} className="card card-hover block p-4">
            <EntryIcon name={c.icon} />
            <p className="mt-2 text-sm font-semibold text-text">{c.label}</p>
            <p className="mt-0.5 text-xs text-text-secondary">{c.desc}</p>
          </Link>
        ))}
      </div>
    </CompanyShell>
  );
}

function StatCard({ label, value, tone }: { label: string; value: string | number; tone: 'success' | 'warning' | 'neutral' | 'primary' }) {
  const colors: Record<string, string> = {
    success: 'text-accent',
    warning: 'text-warning-deep',
    neutral: 'text-text-secondary',
    primary: 'text-text',
  };
  return (
    <div className="card p-4">
      <p className="text-xs text-text-secondary">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${colors[tone]}`}>{value}</p>
    </div>
  );
}

const ENTRY_PATHS: Record<string, string> = {
  job: 'M21 13.3V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v7.3M21 13.3a2 2 0 0 1-2 1.7h-3l-2 3h-4l-2-3H5a2 2 0 0 1-2-1.7M21 13.3V9M3 13.3V9',
  send: 'M22 2 11 13M22 2l-7 20-4-9-9-4 20-7Z',
  chat: 'M21 12a8 8 0 0 1-8 8H4l2-3a8 8 0 1 1 15-5Z',
  star: 'M12 2l2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.8 5.9 20.6l1.4-6.8L2.2 9.1l6.9-.8L12 2z',
  building: 'M4 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16m-12 0h16m-6 0V9h4v12',
  users: 'M16 11a3 3 0 1 0 0-6m2 13c0-2.2-1.8-4-4-4H6c-2.2 0-4 1.8-4 4m18-3c0-2-1.5-3.6-3.4-3.9M8 8a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z',
  card: 'M3 6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6Zm0 4h18',
};

function EntryIcon({ name }: { name: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text">
      <path d={ENTRY_PATHS[name] || ENTRY_PATHS.job} />
    </svg>
  );
}
