import { ok } from '@/lib/api/response';
import { requireAdmin } from '@/lib/auth/admin';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';

/** 置顶平台数据概览：总置顶数/总花费/各城市分布 */
export async function GET() {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;

  const [total, active, pending, totalCost, byCity] = await Promise.all([
    prisma.jobBiddingBoost.count(),
    prisma.jobBiddingBoost.count({ where: { status: 'ACTIVE' } }),
    prisma.jobBiddingBoost.count({ where: { status: 'PENDING' } }),
    prisma.jobBiddingBoost.aggregate({ _sum: { total_cost: true } }),
    prisma.jobBiddingBoost.groupBy({ by: ['city'], _count: { _all: true }, _sum: { total_cost: true } }),
  ]);
  return ok({
    total,
    active,
    pending,
    total_cost: Number(totalCost._sum.total_cost || 0),
    by_city: byCity.map((c) => ({ city: c.city, count: c._count._all, cost: Number(c._sum.total_cost || 0) })),
  });
}
