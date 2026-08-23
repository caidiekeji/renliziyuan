import { NextRequest } from 'next/server';
import { ok, fail } from '@/lib/api/response';
import { requireAdmin, auditLog } from '@/lib/auth/admin';
import { prisma } from '@/lib/db/prisma';
import { getClientIp } from '@/lib/api/response';
import { enqueue } from '@/lib/queue';

export const dynamic = 'force-dynamic';

/** 手动取消订阅（含配额回收） */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;
  const { id } = await params;
  const sub = await prisma.subscription.findUnique({ where: { id } });
  if (!sub) return fail('SUBSCRIPTION_NOT_FOUND', '订阅不存在', 404);
  await prisma.subscription.update({ where: { id }, data: { status: 'CANCELLED' } });
  await enqueue.recycleJobs(sub.company_id, sub.plan_id).catch(() => undefined);
  await auditLog({ adminId: auth.admin.id, action: 'CANCEL_SUBSCRIPTION', targetType: 'SUBSCRIPTION', targetId: id, ip: getClientIp(_req) });
  return ok({ success: true });
}
