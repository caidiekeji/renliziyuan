import { ok } from '@/lib/api/response';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';

/** 可购买套餐列表（公开，供企业选购） */
export async function GET() {
  const plans = await prisma.plan.findMany({
    where: { active: true },
    orderBy: { price_monthly: 'asc' },
  });
  return ok(plans);
}
