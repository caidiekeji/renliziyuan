'use client';

import { Suspense, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { PublicHeader, PublicFooter } from '@/components/layout/PublicLayout';
import { JobCard, type JobCardData } from '@/components/JobCard';
import { api } from '@/lib/api';
import { PageLoading } from '@/components/ui/Spinner';
import { Badge } from '@/components/ui/Badge';
import { Rating } from '@/components/ui/Rating';
import { Empty } from '@/components/ui/Empty';
import { formatDate, COMPANY_VERIFY_LABEL } from '@/lib/utils';

interface CompanyDetail {
  id: string;
  name: string;
  logo?: string | null;
  description?: string | null;
  size?: string | null;
  location?: string | null;
  website?: string | null;
  founded_at?: string | null;
  verify_status: string;
  avg_rating: number;
  review_count: number;
  industry?: { id: string; name: string } | null;
  jobs: JobCardData[];
}

interface ReviewWall {
  items: { id: string; rating: number; content: string; created_at: string; reviewer: { name: string; avatar?: string | null; title?: string | null } }[];
  avg_rating: number;
  review_count: number;
}

function CompanyContent() {
  const { id } = useParams<{ id: string }>();
  const [company, setCompany] = useState<CompanyDetail | null>(null);
  const [reviews, setReviews] = useState<ReviewWall | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([api.get<CompanyDetail>(`/api/companies/${id}`), api.get<ReviewWall>(`/api/companies/${id}/reviews`)])
      .then(([c, r]) => {
        if (c.ok) setCompany(c.data);
        if (r.ok) setReviews(r.data);
        setLoading(false);
      });
  }, [id]);

  if (loading) return <PageLoading />;
  if (!company) {
    return (
      <div className="min-h-screen bg-bg">
        <PublicHeader />
        <Empty title="企业不存在" />
        <PublicFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg">
      <PublicHeader />
      <div className="mx-auto max-w-6xl px-4 py-6">
        {/* 企业头部 */}
        <div className="card p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            {company.logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={company.logo} alt="" className="h-16 w-16 rounded-xl object-cover" />
            ) : (
              <span className="flex h-16 w-16 items-center justify-center rounded-xl bg-primary-soft text-2xl font-bold text-text">
                {company.name.slice(0, 1)}
              </span>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-bold text-text">{company.name}</h1>
                <Badge tone={company.verify_status === 'VERIFIED' ? 'success' : 'default'}>{COMPANY_VERIFY_LABEL[company.verify_status]}</Badge>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-text-secondary">
                {company.industry && <span>行业：{company.industry.name}</span>}
                {company.size && <span>规模：{company.size}</span>}
                {company.location && <span>所在地：{company.location}</span>}
                {company.founded_at && <span>成立：{company.founded_at}</span>}
              </div>
              <div className="mt-2 flex items-center gap-2">
                <Rating value={company.avg_rating} size={16} />
                <span className="text-sm font-semibold text-text">{company.avg_rating ? Number(company.avg_rating).toFixed(1) : '暂无'}</span>
                <span className="text-xs text-text-secondary">{reviews?.review_count ?? company.review_count} 条评价</span>
              </div>
            </div>
          </div>
          {company.description && (
            <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-text-secondary">{company.description}</p>
          )}
          {company.website && (
            <a href={company.website} target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm text-text hover:underline">
              访问官网 →
            </a>
          )}
        </div>

        {/* 在招职位 */}
        <div className="mt-6">
          <h2 className="mb-3 text-lg font-bold text-text">在招职位（{company.jobs.length}）</h2>
          {company.jobs.length === 0 ? (
            <Empty title="暂无在招职位" />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {company.jobs.map((j) => (
                <JobCard key={j.id} job={j} />
              ))}
            </div>
          )}
        </div>

        {/* 评价墙 */}
        <div className="mt-8">
          <h2 className="mb-3 text-lg font-bold text-text">求职者评价</h2>
          {reviews?.items.length ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {reviews.items.map((r) => (
                <div key={r.id} className="card p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-soft text-xs font-semibold text-text">
                        {r.reviewer.name.slice(0, 1)}
                      </span>
                      <span className="text-sm font-medium text-text">{r.reviewer.name}</span>
                    </div>
                    <Rating value={r.rating} size={13} />
                  </div>
                  <p className="mt-2 text-sm text-text-secondary">{r.content}</p>
                  <p className="mt-2 text-xs text-text-secondary/70">{formatDate(r.created_at)}</p>
                </div>
              ))}
            </div>
          ) : (
            <Empty title="暂无评价" />
          )}
        </div>
      </div>
      <PublicFooter />
    </div>
  );
}

export default function CompanyPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <CompanyContent />
    </Suspense>
  );
}
