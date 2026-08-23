'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PublicHeader, PublicFooter } from '@/components/layout/PublicLayout';
import { api, qs } from '@/lib/api';
import { PageLoading } from '@/components/ui/Spinner';

interface City {
  id: string;
  name: string;
  province?: string | null;
  lat: string | number;
  lng: string | number;
}

/** 热门城市：展示职位数气泡 */
const HOT_CITIES = ['北京', '上海', '广州', '深圳', '杭州', '成都', '武汉', '西安', '南京', '重庆'];

function MapContent() {
  const router = useRouter();
  const [cities, setCities] = useState<City[]>([]);
  const [jobCounts, setJobCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      const [cityRes, ...countRes] = await Promise.all([
        api.get<City[]>('/api/cities'),
        ...HOT_CITIES.map((c) => api.get<unknown[]>('/api/jobs' + qs({ city: c, pageSize: 1 }))),
      ]);
      if (cancelled) return;
      if (cityRes.ok) setCities(cityRes.data);
      const counts: Record<string, number> = {};
      countRes.forEach((r, i) => {
        if (r.ok) counts[HOT_CITIES[i]] = Number(r.meta?.total) || 0;
      });
      setJobCounts(counts);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const grouped = useMemo(() => {
    const map = new Map<string, City[]>();
    cities.forEach((c) => {
      const prov = c.province || '其他';
      if (!map.has(prov)) map.set(prov, []);
      map.get(prov)!.push(c);
    });
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0], 'zh'));
  }, [cities]);

  const goCity = (c: string) => router.push(`/jobs?city=${encodeURIComponent(c)}`);

  if (loading) return <PageLoading />;

  return (
    <div className="min-h-screen bg-bg">
      <PublicHeader />
      <div className="mx-auto max-w-6xl px-4 py-6">
        {/* 热门城市气泡 */}
        <section className="mb-8">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-bold text-text">热门城市</h2>
            <span className="text-xs text-text-secondary">点击查看该城市职位</span>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {HOT_CITIES.map((c) => (
              <button
                key={c}
                onClick={() => goCity(c)}
                className="card card-hover flex flex-col items-center justify-center gap-1 rounded-2xl bg-primary-soft/60 p-5 hover:bg-primary-soft"
              >
                <span className="text-base font-bold text-text">{c}</span>
                <span className="text-xs text-text-secondary">
                  {jobCounts[c] != null ? `${jobCounts[c]} 个职位` : '计算中…'}
                </span>
              </button>
            ))}
          </div>
        </section>

        {/* 全部城市按省份分组 */}
        <section>
          <h2 className="mb-3 text-lg font-bold text-text">全部城市</h2>
          <div className="space-y-5">
            {grouped.map(([prov, list]) => (
              <div key={prov}>
                <p className="mb-2 text-sm font-semibold text-text-secondary">{prov}</p>
                <div className="flex flex-wrap gap-2">
                  {list.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => goCity(c.name)}
                      className="rounded-lg border border-border bg-white px-3 py-1.5 text-sm text-text transition hover:border-primary/40 hover:text-text"
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            {grouped.length === 0 && <p className="py-8 text-center text-sm text-text-secondary">暂无城市数据</p>}
          </div>
        </section>
      </div>
      <PublicFooter />
    </div>
  );
}

export default function MapPage() {
  return <MapContent />;
}
