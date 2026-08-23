import { NextRequest } from 'next/server';
import { ok } from '@/lib/api/response';
import { requireAdmin } from '@/lib/auth/admin';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';

/** 会话列表（管理监管） */
export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;
  const keyword = req.nextUrl.searchParams.get('keyword')?.trim();
  const page = Math.max(1, Number(req.nextUrl.searchParams.get('page')) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(req.nextUrl.searchParams.get('pageSize')) || 20));

  const where: any = {};
  if (keyword) {
    where.OR = [
      { candidate: { name: { contains: keyword, mode: 'insensitive' } } },
      { company: { name: { contains: keyword, mode: 'insensitive' } } },
    ];
  }
  const [total, items] = await Promise.all([
    prisma.conversation.count({ where }),
    prisma.conversation.findMany({
      where,
      orderBy: { last_message_at: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        candidate: { select: { id: true, name: true } },
        company: { select: { id: true, name: true } },
        job: { select: { id: true, title: true } },
        messages: { orderBy: { created_at: 'desc' }, take: 1 },
      },
    }),
  ]);
  return ok(items, { total, page, pageSize });
}
