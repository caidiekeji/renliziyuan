import { NextRequest } from 'next/server';
import { ok, fail } from '@/lib/api/response';
import { getUserFromRequest, requireCompanyMember } from '@/lib/auth/session';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';

/** 下线职位 */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUserFromRequest();
  if (!user) return fail('UNAUTHORIZED', '未登录', 401);
  const { id } = await params;
  const job = await prisma.job.findFirst({ where: { id, deleted_at: null } });
  if (!job) return fail('JOB_NOT_FOUND', '职位不存在', 404);
  const { error } = await requireCompanyMember(user, job.company_id, 'HR');
  if (error) return error;
  await prisma.job.update({ where: { id }, data: { status: 'CLOSED', closed_reason: 'COMPANY' } });
  return ok({ status: 'CLOSED' });
}
