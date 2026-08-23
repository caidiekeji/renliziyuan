import { NextRequest } from 'next/server';
import { ok, fail } from '@/lib/api/response';
import { getUserFromRequest } from '@/lib/auth/session';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';

/** 会话消息列表（分页，逆序取） */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUserFromRequest();
  if (!user) return fail('UNAUTHORIZED', '未登录', 401);
  const { id } = await params;

  const conv = await prisma.conversation.findFirst({
    where: {
      id,
      OR: [
        { candidate_id: user.id },
        { company: { members: { some: { user_id: user.id, status: 'ACTIVE' } } } },
      ],
    },
  });
  if (!conv) return fail('CONVERSATION_NOT_FOUND', '会话不存在', 404);

  const cursor = req.nextUrl.searchParams.get('cursor');
  const pageSize = Math.min(50, Number(req.nextUrl.searchParams.get('pageSize')) || 30);
  const messages = await prisma.message.findMany({
    where: { conversation_id: id, is_deleted: false, ...(cursor ? { created_at: { lt: new Date(cursor) } } : {}) },
    orderBy: { created_at: 'desc' },
    take: pageSize,
  });
  // 标记对方消息已读
  await prisma.message.updateMany({
    where: { conversation_id: id, sender_id: { not: user.id }, read_at: null },
    data: { read_at: new Date() },
  });
  return ok(messages.reverse(), { hasMore: messages.length === pageSize });
}
