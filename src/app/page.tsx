'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { PublicHeader, PublicFooter } from '@/components/layout/PublicLayout';
import { JobCard, type JobCardData } from '@/components/JobCard';
import { api, qs } from '@/lib/api';
import { PageLoading } from '@/components/ui/Spinner';
import { useAuth } from '@/lib/auth-context';
import { useAutoCityContext } from '@/components/layout/AutoCityProvider';
import { useSiteConfig } from '@/components/layout/SiteConfigProvider';

export default function HomePage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <HomeContent />
    </Suspense>
  );
}

function HomeContent() {
  const router = useRouter();
  const sp = useSearchParams();
  const { user } = useAuth();
  const { siteName } = useSiteConfig();
  const [keyword, setKeyword] = useState('');
  const [recommended, setRecommended] = useState<JobCardData[]>([]);
  const [hot, setHot] = useState<JobCardData[]>([]);
  const [loading, setLoading] = useState(true);

  const city = sp.get('city') || '全国';
  const hasCityParam = sp.has('city');
  const { locatedCity, done: locateDone } = useAutoCityContext();
  const effectiveCity = hasCityParam ? city : locatedCity || '全国';
  const locateReady = hasCityParam || locateDone;

  useEffect(() => {
    if (!locateReady) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      // 推荐（登录求职者）或热门兜底
      const recPromise =
        user?.role === 'CANDIDATE'
          ? api.get<JobCardData[]>('/api/jobs/recommended' + qs({ pageSize: 10 }))
          : Promise.resolve({ ok: false } as any);
      const hotPromise = api.get<JobCardData[]>('/api/jobs' + qs({ sort: 'hot', pageSize: 12, city: effectiveCity !== '全国' ? effectiveCity : undefined }));
      const [rec, hotRes] = await Promise.all([recPromise, hotPromise]);
      if (cancelled) return;
      if (rec?.ok) setRecommended(rec.data);
      if (hotRes.ok) setHot(hotRes.data);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.role, effectiveCity, locateReady]);

  const search = () => {
    router.push(`/jobs${qs({ keyword: keyword.trim() || undefined, city: effectiveCity !== '全国' ? effectiveCity : undefined })}`);
  };

  const hotCities = ['北京', '上海', '广州', '深圳', '杭州', '成都'];

/** 职位卡片骨架：结构与 JobCard 一致，避免加载时发生布局跳动 */
function JobCardSkeleton() {
  return (
    <div className="card animate-pulse p-4 sm:p-5" aria-hidden="true">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <div className="h-4 w-24 rounded bg-border" />
            <div className="h-4 w-10 rounded-full bg-border" />
          </div>
          <div className="mt-3 h-3.5 w-32 rounded bg-border" />
        </div>
        <div className="h-5 w-16 rounded bg-border" />
      </div>
      <div className="mt-3 flex gap-1.5">
        <div className="h-5 w-14 rounded bg-border" />
        <div className="h-5 w-14 rounded bg-border" />
        <div className="h-5 w-14 rounded bg-border" />
      </div>
      <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
        <div className="h-5 w-24 rounded bg-border" />
        <div className="h-3.5 w-12 rounded bg-border" />
      </div>
    </div>
  );
}

function JobGridSkeleton({ count }: { count: number }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <JobCardSkeleton key={i} />
      ))}
    </div>
  );
}

  return (
    <div className="min-h-screen bg-bg">
      <PublicHeader />

      {/* Hero */}
      <section className="border-b border-border bg-gradient-to-b from-primary-soft/60 to-white">
        <div className="mx-auto max-w-6xl px-4 py-12 text-center sm:py-16">
          <h1 className="text-2xl font-bold text-text sm:text-4xl">
            找到好工作，遇见好人才
          </h1>
          <p className="mt-2 text-sm text-text-secondary sm:text-base">{siteName} —— 连接企业与人才的桥梁</p>
          <div className="mx-auto mt-6 flex max-w-xl items-center gap-2 rounded-full border border-border bg-white p-1.5 shadow-sm">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="ml-3 shrink-0 text-text-secondary">
              <circle cx="11" cy="11" r="7" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && search()}
              placeholder="搜索职位 / 关键词…"
              className="h-11 flex-1 bg-transparent text-sm outline-none"
            />
            <button onClick={search} className="h-11 rounded-full bg-primary px-5 text-sm font-medium text-white hover:bg-primary-hover">
              搜索
            </button>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5 text-xs text-text-secondary">
            <span>热门城市：</span>
            {hotCities.map((c) => (
              <button
                key={c}
                onClick={() => router.push(`/jobs?city=${encodeURIComponent(c)}`)}
                className="rounded-md bg-white px-2 py-0.5 text-text-secondary hover:bg-primary-soft hover:text-text"
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 py-8">
        {!loading && user?.role === 'CANDIDATE' && recommended.length > 0 && (
          <section className="mb-8">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-bold text-text">为你推荐</h2>
              <span className="text-xs text-text-secondary">基于技能 / 城市 / 行为个性化匹配</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {recommended.map((j) => (
                <JobCard key={j.id} job={j} />
              ))}
            </div>
          </section>
        )}

        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-bold text-text">
              {effectiveCity !== '全国' ? `${effectiveCity} · 热门职位` : '热门职位'}
            </h2>
            <button onClick={() => router.push('/jobs' + qs({ city: effectiveCity !== '全国' ? effectiveCity : undefined }))} className="text-sm text-text hover:underline">
              查看全部 →
            </button>
          </div>
          {loading ? (
            <JobGridSkeleton count={12} />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {hot.map((j) => (
                <JobCard key={j.id} job={j} />
              ))}
            </div>
          )}
        </section>
      </div>

      <PublicFooter />
    </div>
  );
}
