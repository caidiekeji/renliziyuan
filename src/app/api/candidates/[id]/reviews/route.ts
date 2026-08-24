import { NextRequest } from 'next/server';
import { ok, fail } from '@/lib/api/response';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';

/** 求职者评价墙（公开）：仅展示未删除且回复审核通过的评价 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const candidate = await prisma.user.findUnique({
    where: { id },
    select: { id: true, name: true, avatar: true, title: true, deleted_at: true },
  });
  if (!candidate) return fail('USER_NOT_FOUND', '用户不存在', 404);

  const page = Math.max(1, Number(req.nextUrl.searchParams.get('page')) || 1);
  const pageSize = Math.min(50, Math.max(1, Number(req.nextUrl.searchParams.get('pageSize')) || 20));
  const where = { candidate_id: id, deleted_at: null, reply_status: 'APPROVED' as const };
  const [total, items, agg] = await Promise.all([
    prisma.review.count({ where }),
    prisma.review.findMany({
      where,
      orderBy: { created_at: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        reviewer: { select: { id: true, name: true, avatar: true } },
        company: { select: { id: true, name: true, logo: true } },
      },
    }),
    prisma.review.aggregate({ where, _avg: { rating: true }, _count: true }),
  ]);
  return ok(
    {
      candidate,
      items,
      avg_rating: agg._avg.rating ?? 0,
      review_count: agg._count,
    },
    { total, page, pageSize }
  );
}
