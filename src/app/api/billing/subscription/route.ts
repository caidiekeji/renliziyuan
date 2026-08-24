import { NextRequest } from 'next/server';
import { ok, fail } from '@/lib/api/response';
import { getUserFromRequest, requireCompanyMember } from '@/lib/auth/session';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';

/** 当前企业订阅状态（billing 上下文，与 /api/subscriptions 统一） */
export async function GET(req: NextRequest) {
  const user = await getUserFromRequest();
  if (!user) return fail('UNAUTHORIZED', '未登录', 401);
  const companyId = req.headers.get('x-company-id');
  if (!companyId) return fail('INVALID_CONTEXT', '缺少企业上下文', 400);
  const { error } = await requireCompanyMember(user, companyId, 'VIEWER');
  if (error) return error;

  const [subscription, openJobCount, plan] = await Promise.all([
    prisma.subscription.findFirst({
      where: { company_id: companyId, status: 'ACTIVE', end_at: { gt: new Date() } },
      orderBy: { end_at: 'desc' },
      include: { plan: true },
    }),
    prisma.job.count({ where: { company_id: companyId, status: 'OPEN', deleted_at: null } }),
    prisma.plan.findMany({ where: { active: true }, orderBy: { price_monthly: 'asc' } }),
  ]);

  return ok({
    subscription,
    open_job_count: openJobCount,
    plans: plan,
  });
}
