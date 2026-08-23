import { NextRequest } from 'next/server';
import { ok, created, fail, handleError } from '@/lib/api/response';
import { requireAdmin, auditLog } from '@/lib/auth/admin';
import { prisma } from '@/lib/db/prisma';
import { planSchema } from '@/lib/validators/zod';
import { getClientIp } from '@/lib/api/response';

export const dynamic = 'force-dynamic';

/** 套餐列表 */
export async function GET() {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;
  const plans = await prisma.plan.findMany({ orderBy: [{ active: 'desc' }, { price_monthly: 'asc' }] });
  return ok(plans);
}

/** 新增套餐 */
export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;
  const parsed = planSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return fail('VALIDATION_ERROR', parsed.error.issues[0]?.message || '参数错误');
  try {
    const plan = await prisma.plan.create({ data: parsed.data });
    await auditLog({ adminId: auth.admin.id, action: 'CREATE_PLAN', targetType: 'PLAN', targetId: plan.id, ip: getClientIp(req) });
    return created(plan);
  } catch (e) {
    return handleError(e);
  }
}
