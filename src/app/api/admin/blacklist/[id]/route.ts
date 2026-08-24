import { NextRequest } from 'next/server';
import { ok, fail } from '@/lib/api/response';
import { requireAdmin, auditLog } from '@/lib/auth/admin';
import { prisma } from '@/lib/db/prisma';
import { getClientIp } from '@/lib/api/response';

export const dynamic = 'force-dynamic';

/** 移出推荐黑名单 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;
  const { id } = await params;
  const item = await prisma.recommendationBlacklist.findUnique({ where: { id } });
  if (!item) return fail('BLACKLIST_NOT_FOUND', '黑名单记录不存在', 404);
  await prisma.recommendationBlacklist.delete({ where: { id } });
  await auditLog({ adminId: auth.admin.id, action: 'UNBLACKLIST_JOB', targetType: 'JOB', targetId: item.job_id, ip: getClientIp(req) });
  return ok({ success: true });
}
