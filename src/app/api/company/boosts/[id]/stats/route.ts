import { NextRequest } from 'next/server';
import { ok, fail } from '@/lib/api/response';
import { getUserFromRequest, requireCompanyMember } from '@/lib/auth/session';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';

/** 置顶数据看板：展示量/花费/当前排名/按天趋势 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUserFromRequest();
  if (!user) return fail('UNAUTHORIZED', '未登录', 401);
  const { id } = await params;
  const boost = await prisma.jobBiddingBoost.findUnique({ where: { id }, include: { job: true } });
  if (!boost) return fail('BOOST_NOT_FOUND', '置顶记录不存在', 404);
  const { member, error } = await requireCompanyMember(user, boost.company_id, 'HR');
  if (!member) return error!;

  // 当前城市下按出价排名的名次（仅统计 ACTIVE）
  const rankList = await prisma.jobBiddingBoost.findMany({
    where: { city: boost.city, status: 'ACTIVE' },
    orderBy: [{ bid: 'desc' }, { start_date: 'asc' }],
    select: { id: true, bid: true },
  });
  const rankIdx = rankList.findIndex((r) => r.id === boost.id);
  const rank = rankIdx >= 0 ? rankIdx + 1 : null;

  // 每日扣费趋势（最近 14 天消费流水）
  const since = new Date();
  since.setDate(since.getDate() - 14);
  const txns = await prisma.walletTransaction.findMany({
    where: { company_id: boost.company_id, type: 'CONSUME', created_at: { gte: since } },
    orderBy: { created_at: 'asc' },
  });
  const trend: { date: string; amount: number }[] = [];
  for (const t of txns) {
    const day = t.created_at.toISOString().slice(0, 10);
    const last = trend[trend.length - 1];
    if (last && last.date === day) last.amount += Number(t.amount);
    else trend.push({ date: day, amount: Number(t.amount) });
  }

  return ok({
    views: boost.job.views,
    cost: Number(boost.total_cost),
    bid: Number(boost.bid),
    rank,
    start_date: boost.start_date,
    end_date: boost.end_date,
    status: boost.status,
    trend,
  });
}
