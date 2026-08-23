import { NextRequest } from 'next/server';
import { ok } from '@/lib/api/response';
import { requireAdmin } from '@/lib/auth/admin';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';

/** 评价列表（管理，含待审回复） */
export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;
  const replyStatus = req.nextUrl.searchParams.get('reply_status');
  const page = Math.max(1, Number(req.nextUrl.searchParams.get('page')) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(req.nextUrl.searchParams.get('pageSize')) || 20));
  const where: any = { deleted_at: null };
  if (replyStatus) where.reply_status = replyStatus;
  const [total, items] = await Promise.all([
    prisma.review.count({ where }),
    prisma.review.findMany({
      where,
      orderBy: { created_at: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        reviewer: { select: { id: true, name: true } },
        company: { select: { id: true, name: true } },
        candidate: { select: { id: true, name: true } },
        conversation: { select: { id: true } },
      },
    }),
  ]);
  return ok(items, { total, page, pageSize });
}
