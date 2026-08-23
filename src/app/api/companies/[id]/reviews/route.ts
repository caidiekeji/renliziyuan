import { NextRequest } from 'next/server';
import { ok, fail } from '@/lib/api/response';
import { getUserFromRequest, requireCompanyMember } from '@/lib/auth/session';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';

/** 企业评价（公开墙 manage=false 仅 APPROVED；企业成员 manage=1 查看全部含待审核回复） */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const manage = req.nextUrl.searchParams.get('manage') === '1';

  let userId: string | null = null;
  if (manage) {
    const user = await getUserFromRequest();
    if (!user) return fail('UNAUTHORIZED', '未登录', 401);
    const { error } = await requireCompanyMember(user, id, 'VIEWER');
    if (error) return error;
    userId = user.id;
  }

  const page = Math.max(1, Number(req.nextUrl.searchParams.get('page')) || 1);
  const pageSize = Math.min(50, Math.max(1, Number(req.nextUrl.searchParams.get('pageSize')) || 20));
  const where: any = { company_id: id, deleted_at: null };
  if (!manage) where.reply_status = 'APPROVED';
  const [total, items, agg] = await Promise.all([
    prisma.review.count({ where }),
    prisma.review.findMany({
      where,
      orderBy: { created_at: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { reviewer: { select: { id: true, name: true, avatar: true, title: true } } },
    }),
    prisma.review.aggregate({ where, _avg: { rating: true }, _count: true }),
  ]);
  return ok(
    { items, avg_rating: agg._avg.rating ?? 0, review_count: agg._count, current_user_id: userId },
    { total, page, pageSize }
  );
}
