import { NextRequest } from 'next/server';
import { ok, fail, handleError } from '@/lib/api/response';
import { requireAdmin, auditLog } from '@/lib/auth/admin';
import { prisma } from '@/lib/db/prisma';
import { planSchema } from '@/lib/validators/zod';
import { getClientIp } from '@/lib/api/response';

export const dynamic = 'force-dynamic';

/** 更新套餐 */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;
  const { id } = await params;
  const parsed = planSchema.partial().safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return fail('VALIDATION_ERROR', parsed.error.issues[0]?.message || '参数错误');
  try {
    const plan = await prisma.plan.update({ where: { id }, data: parsed.data });
    await auditLog({ adminId: auth.admin.id, action: 'UPDATE_PLAN', targetType: 'PLAN', targetId: id, detail: parsed.data, ip: getClientIp(req) });
    return ok(plan);
  } catch (e) {
    return handleError(e);
  }
}

/** 删除套餐（存在订阅则仅停用） */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;
  const { id } = await params;
  const used = await prisma.subscription.count({ where: { plan_id: id } });
  if (used > 0) {
    await prisma.plan.update({ where: { id }, data: { active: false } });
    return ok({ success: true, note: '套餐已有订阅，已改为停用' });
  }
  await prisma.plan.delete({ where: { id } });
  await auditLog({ adminId: auth.admin.id, action: 'DELETE_PLAN', targetType: 'PLAN', targetId: id, ip: getClientIp(req) });
  return ok({ success: true });
}
