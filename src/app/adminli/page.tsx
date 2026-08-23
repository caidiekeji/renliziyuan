'use client';

import { useEffect, useState } from 'react';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { Card } from '@/components/ui/Card';
import { Empty } from '@/components/ui/Empty';
import { PageLoading } from '@/components/ui/Spinner';
import { useRoleGuard } from '@/lib/route-guard';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { ADMIN_NAV } from '@/lib/admin-nav';

interface TrendItem {
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

interface DashboardData {
  totalUsers: number;
  newUsersToday: number;
  activeCompanies: number;
  totalJobs: number;
  openJobs: number;
  pendingJobs: number;
  totalConversations: number;
  totalPayments: number;
  revenue: number;
  pendingReviews: number;
  pendingReports: number;
  onlineCount: number;
  trend: TrendItem[];
}

/** 近 7 日趋势中的新增用户柱状条 */
function Bar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="h-2 w-20 overflow-hidden rounded bg-bg-subtle">
      <div className="h-full rounded bg-primary" style={{ width: `${Math.max(2, Math.min(100, pct))}%` }} />
    </div>
  );
}

export default function AdminDashboardPage() {
  const guarding = useRoleGuard(['ADMIN'], '/');
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<DashboardData>('/api/admin/dashboard').then((r) => {
      if (r.ok) setData(r.data);
      setLoading(false);
    });
  }, []);

  if (guarding) return <PageLoading />;

  const stats: { label: string; value: string | number; tone: string }[] = [
    { label: '用户总数', value: data?.totalUsers ?? '-', tone: 'text-text' },
    { label: '今日新增用户', value: data?.newUsersToday ?? '-', tone: 'text-accent' },
    { label: '企业总数', value: data?.activeCompanies ?? '-', tone: 'text-text' },
    { label: '职位总数', value: data?.totalJobs ?? '-', tone: 'text-text' },
    { label: '在招职位', value: data?.openJobs ?? '-', tone: 'text-accent' },
    { label: '待审核职位', value: data?.pendingJobs ?? '-', tone: 'text-warning-deep' },
    { label: '会话总数', value: data?.totalConversations ?? '-', tone: 'text-text' },
    { label: '支付笔数', value: data?.totalPayments ?? '-', tone: 'text-text' },
    { label: '累计成交额', value: data ? `¥${Number(data.revenue || 0).toLocaleString()}` : '-', tone: 'text-accent' },
    { label: '待审核评价', value: data?.pendingReviews ?? '-', tone: 'text-warning-deep' },
    { label: '待处理举报', value: data?.pendingReports ?? '-', tone: 'text-danger' },
    { label: '在线用户', value: data?.onlineCount ?? '-', tone: 'text-text-secondary' },
  ];

  const trend = data?.trend || [];
  const maxNewUsers = trend.reduce((m, t) => Math.max(m, t.new_users || 0), 1);

  return (
    <DashboardShell nav={ADMIN_NAV} title="管理后台" sub="数据概览">
      <h1 className="mb-4 text-lg font-bold text-text">数据概览</h1>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="card p-4">
            <p className="text-xs text-text-secondary">{s.label}</p>
            <p className={`mt-1 text-xl font-bold sm:text-2xl ${s.tone}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <h2 className="mb-3 mt-6 text-base font-bold text-text">近 7 日趋势</h2>
      <Card>
        {loading ? (
          <PageLoading />
        ) : trend.length === 0 ? (
          <Empty title="暂无统计数据" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-text-secondary">
                  <th className="px-3 py-2 font-medium">日期</th>
                  <th className="px-3 py-2 font-medium">新增用户</th>
                  <th className="px-3 py-2 font-medium">新增企业</th>
                  <th className="px-3 py-2 font-medium">新增职位</th>
                  <th className="px-3 py-2 font-medium">新增会话</th>
                  <th className="px-3 py-2 font-medium">新增评价</th>
                  <th className="px-3 py-2 font-medium">成交金额</th>
                </tr>
              </thead>
              <tbody>
                {trend.map((t) => (
                  <tr key={String(t.stat_date)} className="border-b border-border/60 last:border-0">
                    <td className="px-3 py-2.5 text-text-secondary">{formatDate(t.stat_date)}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="w-6 text-right font-medium text-text">{t.new_users}</span>
                        <Bar value={t.new_users || 0} max={maxNewUsers} />
                      </div>
                    </td>
                    <td className="px-3 py-2.5">{t.new_companies}</td>
                    <td className="px-3 py-2.5">{t.new_jobs}</td>
                    <td className="px-3 py-2.5">{t.new_conversations}</td>
                    <td className="px-3 py-2.5">{t.new_reviews}</td>
                    <td className="px-3 py-2.5 font-medium text-text">¥{Number(t.paid_amount || 0).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </DashboardShell>
  );
}
