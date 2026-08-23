import { NextRequest } from 'next/server';
import { ok, fail } from '@/lib/api/response';
import { getUserFromRequest } from '@/lib/auth/session';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';

/** 我的收藏列表 */
export async function GET(req: NextRequest) {
  const user = await getUserFromRequest();
  if (!user) return fail('UNAUTHORIZED', '未登录', 401);
  const page = Math.max(1, Number(req.nextUrl.searchParams.get('page')) || 1);
  const pageSize = Math.min(50, Math.max(1, Number(req.nextUrl.searchParams.get('pageSize')) || 20));
  const [total, items] = await Promise.all([
    prisma.favorite.count({ where: { user_id: user.id } }),
    prisma.favorite.findMany({
      where: { user_id: user.id },
      orderBy: { created_at: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        job: { include: { company: { select: { id: true, name: true, logo: true } } } },
      },
    }),
  ]);
  const list = items.filter((f) => f.job && !f.job.deleted_at);
  return ok(list, { total, page, pageSize });
}
