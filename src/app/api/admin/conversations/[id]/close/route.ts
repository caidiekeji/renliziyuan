import { NextRequest } from 'next/server';
import { ok, fail } from '@/lib/api/response';
import { requireAdmin, auditLog } from '@/lib/auth/admin';
import { prisma } from '@/lib/db/prisma';
import { getClientIp } from '@/lib/api/response';
import { notifyUser } from '@/lib/notification';
import { getIO } from '@/lib/socket/server';

export const dynamic = 'force-dynamic';

/** 强制关闭会话（聊天治理）：置 closed_at + 通知双方 + 实时踢出会话房间 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;
  const { id } = await params;
  const conv = await prisma.conversation.findUnique({
    where: { id },
    include: { company: { select: { id: true, name: true, owner_id: true } } },
  });
  if (!conv) return fail('CONVERSATION_NOT_FOUND', '会话不存在', 404);
  if (conv.closed_at) return fail('CONVERSATION_CLOSED', '会话已关闭');

  await prisma.conversation.update({ where: { id }, data: { closed_at: new Date() } });

  // 通知会话双方（求职者 + 企业活跃成员，去重）
  const companyMember = await prisma.companyMember.findFirst({
    where: { company_id: conv.company_id, status: 'ACTIVE' },
    orderBy: [{ is_primary_contact: 'desc' }, { created_at: 'asc' }],
    select: { user_id: true },
  });
  const userIds = [conv.candidate_id, conv.company.owner_id, companyMember?.user_id].filter(
    (v, i, a): v is string => !!v && a.indexOf(v) === i
  );
  await Promise.all(
    userIds.map((userId) =>
      notifyUser({
        userId,
        type: 'SYSTEM',
        title: '会话已被管理员关闭',
        body: `与「${conv.company.name}」的会话已关闭，无法继续发送消息`,
        link: '/messages',
      })
    )
  );

  // 实时通知会话双方断开（前端监听 chat:closed 后跳转/禁用输入）
  getIO()?.to(`conv:${id}`).emit('chat:closed', { conversationId: id });

  await auditLog({ adminId: auth.admin.id, action: 'CLOSE_CONVERSATION', targetType: 'CONVERSATION', targetId: id, ip: getClientIp(req) });
  return ok({ success: true });
}
