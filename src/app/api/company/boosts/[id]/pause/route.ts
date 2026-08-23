import { NextRequest } from 'next/server';
import { ok, fail } from '@/lib/api/response';
import { getUserFromRequest, requireCompanyMember } from '@/lib/auth/session';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';

/** 暂停置顶（仅 ACTIVE 可暂停） */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUserFromRequest();
  if (!user) return fail('UNAUTHORIZED', '未登录', 401);
  const { id } = await params;
  const boost = await prisma.jobBiddingBoost.findUnique({ where: { id } });
  if (!boost) return fail('BOOST_NOT_FOUND', '置顶记录不存在', 404);
  const { member, error } = await requireCompanyMember(user, boost.company_id, 'HR');
  if (!member) return error!;
  if (boost.status !== 'ACTIVE') return fail('NOT_PAUSABLE', '仅生效中的置顶可暂停', 400);

  const updated = await prisma.jobBiddingBoost.update({
    where: { id },
    data: { status: 'PAUSED', paused_at: new Date() },
  });
  return ok(updated);
}
