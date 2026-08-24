import { NextRequest } from 'next/server';
import { ok, fail } from '@/lib/api/response';
import { getUserFromRequest, requireCompanyMember } from '@/lib/auth/session';
import { prisma } from '@/lib/db/prisma';
import { enqueue } from '@/lib/queue';

export const dynamic = 'force-dynamic';

/** 取消续费（企业侧）：将当前有效订阅置为 CANCELLED 并触发配额回收 */
export async function POST(req: NextRequest) {
  const user = await getUserFromRequest();
  if (!user) return fail('UNAUTHORIZED', '未登录', 401);
  const companyId = req.headers.get('x-company-id');
  if (!companyId) return fail('INVALID_CONTEXT', '缺少企业上下文', 400);
  const { error } = await requireCompanyMember(user, companyId, 'HR');
  if (error) return error;

  const sub = await prisma.subscription.findFirst({
    where: { company_id: companyId, status: 'ACTIVE', end_at: { gt: new Date() } },
    orderBy: { end_at: 'desc' },
  });
  if (!sub) return ok({ success: true, cancelled: false });

  await prisma.subscription.update({ where: { id: sub.id }, data: { status: 'CANCELLED' } });
  await enqueue.recycleJobs(companyId, sub.plan_id).catch(() => undefined);
  return ok({ success: true, cancelled: true, end_at: sub.end_at });
}
