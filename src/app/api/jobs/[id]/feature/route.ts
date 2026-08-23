import { NextRequest } from 'next/server';
import { ok, fail } from '@/lib/api/response';
import { getUserFromRequest, requireCompanyMember } from '@/lib/auth/session';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';

/** 置顶职位（需套餐 can_feature） */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUserFromRequest();
  if (!user) return fail('UNAUTHORIZED', '未登录', 401);
  const { id } = await params;
  const job = await prisma.job.findFirst({ where: { id, deleted_at: null } });
  if (!job) return fail('JOB_NOT_FOUND', '职位不存在', 404);
  const { error } = await requireCompanyMember(user, job.company_id, 'HR');
  if (error) return error;

  const sub = await prisma.subscription.findFirst({
    where: { company_id: job.company_id, status: 'ACTIVE', end_at: { gt: new Date() } },
    include: { plan: true },
  });
  if (!sub?.plan.can_feature) return fail('FEATURE_NOT_ALLOWED', '当前套餐不支持置顶', 403);

  const updated = await prisma.job.update({ where: { id }, data: { is_featured: true } });
  return ok({ is_featured: updated.is_featured });
}
