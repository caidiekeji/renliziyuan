import { NextRequest } from 'next/server';
import { ok, fail } from '@/lib/api/response';
import { getUserFromRequest, requireCompanyMember } from '@/lib/auth/session';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';

/** 提交企业认证（OWNER，重新进入 PENDING） */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUserFromRequest();
  if (!user) return fail('UNAUTHORIZED', '未登录', 401);
  const { id } = await params;
  const { member, error } = await requireCompanyMember(user, id, 'OWNER');
  if (!member) return error!;
  const updated = await prisma.company.update({ where: { id }, data: { verify_status: 'PENDING' } });
  return ok({ verify_status: updated.verify_status });
}
