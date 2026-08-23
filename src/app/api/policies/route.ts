import { ok } from '@/lib/api/response';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';

/** 已发布条款列表（公开） */
export async function GET() {
  const list = await prisma.policy.findMany({
    where: { status: 'PUBLISHED' },
    orderBy: [{ key: 'asc' }, { version: 'desc' }],
    select: { key: true, title: true, version: true, published_at: true },
  });
  return ok(list);
}
