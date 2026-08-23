import { NextRequest } from 'next/server';
import { ok, fail } from '@/lib/api/response';
import { getUserFromRequest } from '@/lib/auth/session';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';

/** 我收到的评价（作为求职者） */
export async function GET(req: NextRequest) {
  const user = await getUserFromRequest();
  if (!user) return fail('UNAUTHORIZED', '未登录', 401);
  const page = Math.max(1, Number(req.nextUrl.searchParams.get('page')) || 1);
  const pageSize = Math.min(50, Math.max(1, Number(req.nextUrl.searchParams.get('pageSize')) || 20));
  const [total, items] = await Promise.all([
    prisma.review.count({ where: { candidate_id: user.id, deleted_at: null } }),
    prisma.review.findMany({
      where: { candidate_id: user.id, deleted_at: null },
      orderBy: { created_at: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        reviewer: { select: { id: true, name: true, avatar: true } },
        company: { select: { id: true, name: true, logo: true } },
      },
    }),
  ]);
  return ok(items, { total, page, pageSize });
}
