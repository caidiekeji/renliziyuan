import { NextRequest } from 'next/server';
import { ok } from '@/lib/api/response';
import { requireAdmin } from '@/lib/auth/admin';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';

/** 会话消息（管理监管） */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;
  const { id } = await params;
  const messages = await prisma.message.findMany({
    where: { conversation_id: id },
    orderBy: { created_at: 'asc' },
    include: { sender: { select: { id: true, name: true } } },
  });
  return ok(messages);
}
