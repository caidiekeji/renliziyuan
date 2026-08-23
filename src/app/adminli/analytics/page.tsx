'use client';

import { useEffect, useState } from 'react';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { Card } from '@/components/ui/Card';
import { Empty } from '@/components/ui/Empty';
import { PageLoading } from '@/components/ui/Spinner';
import { ChinaMap } from '@/components/ui/ChinaMap';
import { useRoleGuard } from '@/lib/route-guard';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { ADMIN_NAV } from '@/lib/admin-nav';

interface DailyStat {
  stat_date: string;
  pv: number;
  uv: number;
  dau: number;
  wau: number;
  mau: number;
  new_users: number;
  new_companies: number;
  new_jobs: number;
  new_conversations: number;
  new_reviews: number;
  paid_amount: number | string;
  active_companies: number;
}

interface AnalyticsData {
  dailyStats: DailyStat[];
  totals: {
    pv: number;
    uv: number;
    dau: number;
    new_users: number;
    paid_amount: number;
  };
  topCities: { province: string; _count: { _all: number } }[];
}

const RANGES = [
  { value: 7, label: '近 7 天' },
  { value: 30, label: '近 30 天' },
  { value: 90, label: '近 90 天' },
];

export default function AdminAnalyticsPage() {
  const guarding = useRoleGuard(['ADMIN'], '/');
  const [range, setRange] = useState(7);
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get<AnalyticsData>(`/api/admin/analytics?range=${range}`).then((r) => {
      if (r.ok) setData(r.data);
      setLoading(false);
    });
  }, [range]);

  if (guarding) return <PageLoading />;

  const dailyStats = data?.dailyStats || [];
  const totals = data?.totals;
  const topCities = data?.topCities || [];

  const maxDau = dailyStats.reduce((m, d) => Math.max(m, d.dau || 0), 1);
  const maxNewUsers = dailyStats.reduce((m, d) => Math.max(m, d.new_users || 0), 1);

  const statCards = [
    { label: '浏览量 PV', value: totals?.pv, tone: 'text-text' },
    { label: '访客数 UV', value: totals?.uv, tone: 'text-text' },
    { label: '日活 DAU', value: totals?.dau, tone: 'text-text' },
    { label: '新增用户', value: totals?.new_users, tone: 'text-accent' },
    { label: '成交金额', value: totals ? `¥${Number(totals.paid_amount || 0).toLocaleString()}` : undefined, tone: 'text-accent' },
  ];

  return (
    <DashboardShell nav={ADMIN_NAV} title="管理后台" sub="数据分析">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-bold text-text">数据分析</h1>
        <div className="flex gap-1.5">
          {RANGES.map((r) => (
            <button
              key={r.value}
              onClick={() => setRange(r.value)}
              className={`h-8 rounded-lg px-3 text-sm font-medium transition-colors ${
                range === r.value ? 'bg-primary text-white' : 'bg-white text-text-secondary hover:text-text border border-border'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <PageLoading />
      ) : dailyStats.length === 0 ? (
        <Empty title="暂无统计数据" description="所选时间范围内暂无日报统计，请稍后再试" />
      ) : (
        <div className="space-y-4">
          {/* 汇总统计卡 */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {statCards.map((s) => (
              <div key={s.label} className="card p-4">
                <p className="text-xs text-text-secondary">{s.label}</p>
                <p className={`mt-1 text-xl font-bold sm:text-2xl ${s.tone}`}>{s.value ?? '-'}</p>
              </div>
            ))}
          </div>

          {/* 趋势图（DAU / 新增用户 双序列） */}
          <Card title="DAU / 新增用户 趋势">
            <div className="mb-3 flex items-center gap-4 text-xs text-text-secondary">
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-sm bg-primary" />
                日活 DAU
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-sm bg-accent" />
                新增用户
              </span>
            </div>
            <div className="overflow-x-auto pb-1">
              <div className="flex items-end gap-1.5">
                {dailyStats.map((d) => (
                  <div key={String(d.stat_date)} className="flex min-w-11 flex-1 flex-col items-center gap-1.5">
                    <div className="flex h-32 w-full items-end justify-center gap-1">
                      <div
                        className="w-2.5 rounded-t bg-primary sm:w-3"
                        style={{ height: `${((d.dau || 0) / maxDau) * 100}%` }}
                        title={`DAU: ${d.dau}`}
                      />
                      <div
                        className="w-2.5 rounded-t bg-accent sm:w-3"
                        style={{ height: `${((d.new_users || 0) / maxNewUsers) * 100}%` }}
                        title={`新增用户: ${d.new_users}`}
                      />
                    </div>
                    <span className="whitespace-nowrap text-[10px] text-text-secondary">{formatDate(d.stat_date)}</span>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          {/* 地域分布 */}
          <Card title="地域访问分布">
            {topCities.length === 0 ? (
              <Empty title="暂无地域数据" description="所选时间范围内暂无访问来源数据" />
            ) : (
              <ChinaMap
                data={topCities.map((c) => ({ name: c.province, value: c._count._all }))}
              />
            )}
          </Card>
        </div>
      )}
    </DashboardShell>
  );
}
