import { NextRequest } from 'next/server';
import { ok, fail } from '@/lib/api/response';
import { requireAdmin, auditLog } from '@/lib/auth/admin';
import { prisma } from '@/lib/db/prisma';
import { getClientIp } from '@/lib/api/response';

export const dynamic = 'force-dynamic';

/** 删除企业/求职者回复（管理员）：清空回复内容与审核状态，评价本身保留 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;
  const { id } = await params;
  const review = await prisma.review.findFirst({ where: { id, deleted_at: null } });
  if (!review) return fail('REVIEW_NOT_FOUND', '评价不存在', 404);
  if (!review.reply) return fail('NO_REPLY', '该评价暂无回复');

  await prisma.review.update({
    where: { id },
    data: { reply: null, reply_by: null, reply_status: 'APPROVED', reply_reviewed_by: null },
  });
  await auditLog({ adminId: auth.admin.id, action: 'DELETE_REVIEW_REPLY', targetType: 'REVIEW', targetId: id, ip: getClientIp(req) });
  return ok({ success: true });
}
