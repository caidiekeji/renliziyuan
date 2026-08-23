import { NextRequest } from 'next/server';
import { ok, fail } from '@/lib/api/response';
import { getUserFromRequest, requireCompanyMember } from '@/lib/auth/session';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';

/** 查看小时工职位报名列表（企业成员 HR+，本企业资源） */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUserFromRequest();
  if (!user) return fail('UNAUTHORIZED', '未登录', 401);
  const { id } = await params;

  const job = await prisma.job.findUnique({ where: { id } });
  if (!job) return fail('JOB_NOT_FOUND', '职位不存在', 404);
  const { member, error } = await requireCompanyMember(user, job.company_id, 'HR');
  if (!member) return error!;

  const items = await prisma.hourlyJobApplication.findMany({
    where: { job_id: id },
    orderBy: { created_at: 'desc' },
    include: {
      user: { select: { id: true, name: true, avatar: true, title: true, city: true } },
    },
  });
  return ok(items);
}
