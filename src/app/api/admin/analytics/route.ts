import { NextRequest } from 'next/server';
import { ok } from '@/lib/api/response';
import { requireAdmin } from '@/lib/auth/admin';
import { prisma } from '@/lib/db/prisma';
import { getOnlineCount } from '@/lib/socket/server';

export const dynamic = 'force-dynamic';

/** 数据统计（日报趋势/汇总/地域分布） */
export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;
  const raw = Number(req.nextUrl.searchParams.get('range')) || 7;
  const range = [7, 30, 90].includes(raw) ? raw : 7;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const ago = new Date(today.getTime() - (range - 1) * 24 * 3600 * 1000);

  const dailyStats = await prisma.dailyStat.findMany({
    where: { stat_date: { gte: ago } },
    orderBy: { stat_date: 'asc' },
  });
  const totals = {
    pv: dailyStats.reduce((s, d) => s + d.pv, 0),
    uv: dailyStats.reduce((s, d) => s + d.uv, 0),
    dau: dailyStats.reduce((s, d) => s + d.dau, 0),
    new_users: dailyStats.reduce((s, d) => s + d.new_users, 0),
    new_companies: dailyStats.reduce((s, d) => s + d.new_companies, 0),
    new_jobs: dailyStats.reduce((s, d) => s + d.new_jobs, 0),
    new_conversations: dailyStats.reduce((s, d) => s + d.new_conversations, 0),
    new_reviews: dailyStats.reduce((s, d) => s + d.new_reviews, 0),
    paid_amount: dailyStats.reduce((s, d) => s + Number(d.paid_amount), 0),
  };
  const topCities = await prisma.pageView.groupBy({
    by: ['province'],
    where: { province: { not: null } },
    _count: { _all: true },
    orderBy: { _count: { province: 'desc' } },
  });
  const [deviceStats, online] = await Promise.all([
    prisma.pageView.groupBy({
      by: ['device'],
      where: { device: { not: null } },
      _count: { _all: true },
    }),
    getOnlineCount(),
  ]);

  // 转化漏斗：访客 → 注册 → 发起会话 → 产生评价
  const funnel = [
    { step: '访客(PV)', value: totals.pv },
    { step: '独立访客(UV)', value: totals.uv },
    { step: '注册用户', value: totals.new_users },
    { step: '发起会话', value: totals.new_conversations },
    { step: '产生评价', value: totals.new_reviews },
  ];

  return ok({ dailyStats, totals, topCities, deviceStats, funnel, realtime: { online } });
}
