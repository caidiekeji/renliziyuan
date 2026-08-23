'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CandidateShell } from '@/components/layout/CandidateShell';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { PageLoading } from '@/components/ui/Spinner';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useRoleGuard } from '@/lib/route-guard';
import { ROLE_LABEL } from '@/lib/utils';

function StatCard({
  label,
  value,
  href,
  icon,
  tone,
}: {
  label: string;
  value: number | string;
  href?: string;
  icon: React.ReactNode;
  tone: string;
}) {
  const body = (
    <div className={`card card-hover p-4 sm:p-5 ${href ? '' : 'cursor-default'}`}>
      <div className="flex items-center justify-between">
        <span className={`flex h-10 w-10 items-center justify-center rounded-lg ${tone}`}>{icon}</span>
        <span className="text-2xl font-bold text-text">{value}</span>
      </div>
      <p className="mt-3 text-sm font-medium text-text">{label}</p>
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

export default function CandidateHomePage() {
  const guarding = useRoleGuard(['CANDIDATE'], '/');
  const { user } = useAuth();
  const [seekers, setSeekers] = useState(0);
  const [favorites, setFavorites] = useState(0);
  const [reviews, setReviews] = useState(0);

  useEffect(() => {
    api.get<unknown[]>('/api/seeker-posts/me').then((r) => r.ok && setSeekers(r.data.length));
    api.get<unknown[]>('/api/me/favorites').then((r) => r.ok && setFavorites(Number(r.meta?.total) || r.data.length));
    api.get<unknown[]>('/api/me/reviews').then((r) => r.ok && setReviews(Number(r.meta?.total) || r.data.length));
  }, []);

  if (guarding || !user) return <PageLoading />;

  const unread = user.unread || 0;
  const skills = user.skills || [];

  return (
    <CandidateShell sub="个人中心">
      {/* 资料卡 */}
      <Card className="mb-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          {user.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.avatar} alt="" className="h-16 w-16 rounded-full object-cover" />
          ) : (
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-primary-soft text-2xl font-bold text-text">
              {user.name.slice(0, 1)}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold text-text">{user.name}</h1>
              <Badge tone="primary">{ROLE_LABEL[user.role] || user.role}</Badge>
            </div>
            <p className="mt-1 text-sm text-text-secondary">
              {[user.title, user.city].filter(Boolean).join(' · ') || '完善资料，让企业更快找到你'}
            </p>
            {skills.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {skills.map((s) => (
                  <Badge key={s} tone="default">
                    {s}
                  </Badge>
                ))}
              </div>
            )}
          </div>
          <Link href="/candidate/profile" className="shrink-0">
            <span className="inline-flex h-10 items-center rounded-lg bg-primary-soft px-4 text-sm font-medium text-text hover:bg-primary-soft-hover">
              编辑资料
            </span>
          </Link>
        </div>
        {user.bio && <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-text-secondary">{user.bio}</p>}
      </Card>

      {/* 统计入口卡片 */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="我的求职信息" value={seekers} href="/candidate/seekers" tone="bg-primary-soft text-text"
          icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9l-6-6Zm0 0v6h6" /></svg>} />
        <StatCard label="我的收藏" value={favorites} href="/candidate/favorites" tone="bg-warning-soft text-warning"
          icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.8 5.9 20.6l1.4-6.8L2.2 9.1l6.9-.8L12 2z" /></svg>} />
        <StatCard label="我的评价" value={reviews} tone="bg-accent-soft text-accent"
          icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a8 8 0 0 1-8 8H4l2-3a8 8 0 1 1 15-5Z" /></svg>} />
        <StatCard label="消息" value={unread} href="/candidate/messages" tone="bg-danger-soft text-danger"
          icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9m6 11a2 2 0 0 1-2-2h4a2 2 0 0 1-2 2Z" /></svg>} />
      </div>

      {user.companies.length > 0 && (
        <Card className="mt-5" title="我关联的企业">
          <div className="flex flex-col gap-2">
            {user.companies.map((c) => (
              <Link key={c.id} href={`/companies/${c.id}`} className="flex items-center justify-between rounded-lg px-2 py-2 hover:bg-bg-subtle">
                <span className="flex items-center gap-2 text-sm text-text">
                  {c.logo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.logo} alt="" className="h-6 w-6 rounded object-cover" />
                  ) : (
                    <span className="flex h-6 w-6 items-center justify-center rounded bg-primary-soft text-xs font-bold text-text">{c.name.slice(0, 1)}</span>
                  )}
                  {c.name}
                </span>
                <Badge tone="neutral">{c.role === 'OWNER' ? '管理员' : '成员'}</Badge>
              </Link>
            ))}
          </div>
        </Card>
      )}
    </CandidateShell>
  );
}
