import { NextRequest } from 'next/server';
import { ok, fail } from '@/lib/api/response';
import { getUserFromRequest, requireCompanyMember } from '@/lib/auth/session';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';

/** 我的企业订阅（企业上下文） */
export async function GET(req: NextRequest) {
  const user = await getUserFromRequest();
  if (!user) return fail('UNAUTHORIZED', '未登录', 401);
  const companyId = req.headers.get('x-company-id');
  if (!companyId) return fail('INVALID_CONTEXT', '缺少企业上下文', 400);
  const { error } = await requireCompanyMember(user, companyId, 'VIEWER');
  if (error) return error;

  const subscription = await prisma.subscription.findFirst({
    where: { company_id: companyId, status: 'ACTIVE' },
    orderBy: { end_at: 'desc' },
    include: { plan: true },
  });
  const openJobCount = await prisma.job.count({ where: { company_id: companyId, status: 'OPEN', deleted_at: null } });
  return ok({
    subscription: subscription && new Date(subscription.end_at) > new Date() ? subscription : null,
    open_job_count: openJobCount,
  });
}
