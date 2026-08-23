import { NextRequest } from 'next/server';
import { ok, fail } from '@/lib/api/response';
import { getUserFromRequest } from '@/lib/auth/session';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';

/** 我的小时工报名（已报名/已取消列表） */
export async function GET(req: NextRequest) {
  const user = await getUserFromRequest();
  if (!user) return fail('UNAUTHORIZED', '未登录', 401);

  const url = new URL(req.url);
  const status = url.searchParams.get('status'); // APPLIED | CANCELLED
  const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
  const pageSize = Math.min(50, Math.max(1, Number(url.searchParams.get('pageSize')) || 20));

  const where: any = { user_id: user.id };
  if (status) where.status = status;

  const [total, items] = await Promise.all([
    prisma.hourlyJobApplication.count({ where }),
    prisma.hourlyJobApplication.findMany({
      where,
      orderBy: { created_at: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        job: {
          include: {
            company: { select: { id: true, name: true, logo: true } },
            industry: { select: { id: true, name: true } },
          },
        },
      },
    }),
  ]);
  return ok(items, { total, page, pageSize });
}
