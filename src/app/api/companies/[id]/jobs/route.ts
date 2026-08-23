import { NextRequest } from 'next/server';
import { ok, fail } from '@/lib/api/response';
import { getUserFromRequest, requireCompanyMember } from '@/lib/auth/session';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';

/** 企业职位管理列表（含已下线/待审核，成员可见） */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUserFromRequest();
  if (!user) return fail('UNAUTHORIZED', '未登录', 401);
  const { id } = await params;
  const { error } = await requireCompanyMember(user, id, 'VIEWER');
  if (error) return error;

  const page = Math.max(1, Number(req.nextUrl.searchParams.get('page')) || 1);
  const pageSize = Math.min(50, Math.max(1, Number(req.nextUrl.searchParams.get('pageSize')) || 20));
  const isHourly = req.nextUrl.searchParams.get('is_hourly');
  const where: any = { company_id: id, deleted_at: null };
  if (isHourly === 'true') where.is_hourly = true;
  if (isHourly === 'false') where.is_hourly = false;

  const [total, items] = await Promise.all([
    prisma.job.count({ where }),
    prisma.job.findMany({
      where,
      orderBy: { created_at: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        industry: { select: { id: true, name: true } },
        job_title: { select: { id: true, name: true } },
        hourly_applications: { select: { status: true } },
      },
    }),
  ]);
  return ok(items, { total, page, pageSize });
}
