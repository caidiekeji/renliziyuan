import { NextRequest } from 'next/server';
import { ok, fail } from '@/lib/api/response';
import { requireAdmin, auditLog } from '@/lib/auth/admin';
import { prisma } from '@/lib/db/prisma';
import { getClientIp } from '@/lib/api/response';
import { emitMessageDeleted } from '@/lib/socket/server';

export const dynamic = 'force-dynamic';

/** 删除违规消息（管理，软删） */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;
  const { id } = await params;
  const msg = await prisma.message.findUnique({ where: { id } });
  if (!msg) return fail('MESSAGE_NOT_FOUND', '消息不存在', 404);
  await prisma.message.update({ where: { id }, data: { is_deleted: true, deleted_by: auth.admin.id } });
  // 实时下发软删事件，会话双方前端移除该条消息
  emitMessageDeleted(msg.conversation_id, msg.id);
  await auditLog({ adminId: auth.admin.id, action: 'DELETE_MESSAGE', targetType: 'MESSAGE', targetId: id, ip: getClientIp(_req) });
  return ok({ success: true });
}
