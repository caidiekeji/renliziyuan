import { NextRequest } from 'next/server';
import { ok } from '@/lib/api/response';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';

/** 公告列表（公开）：banner + notice 均返回，过滤未开始/已结束 */
export async function GET(req: NextRequest) {
  const now = new Date();
  const type = req.nextUrl.searchParams.get('type');
  const items = await prisma.announcement.findMany({
    where: {
      active: true,
      ...(type ? { type: type as any } : {}),
      AND: [{ OR: [{ start_at: null }, { start_at: { lte: now } }] }, { OR: [{ end_at: null }, { end_at: { gte: now } }] }],
    },
    orderBy: [{ sort: 'desc' }, { created_at: 'desc' }],
    take: 50,
  });
  return ok(items);
}
