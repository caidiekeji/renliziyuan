import { NextRequest } from 'next/server';
import { ok, fail, handleError } from '@/lib/api/response';
import { getUserFromRequest, requireCompanyMember } from '@/lib/auth/session';
import { prisma } from '@/lib/db/prisma';
import { createPaymentSchema } from '@/lib/validators/zod';
import { createPayment } from '@/lib/payment';
import { getSiteConfig } from '@/lib/config';

export const dynamic = 'force-dynamic';

/** 我的企业支付历史 */
export async function GET(req: NextRequest) {
  const user = await getUserFromRequest();
  if (!user) return fail('UNAUTHORIZED', '未登录', 401);
  const companyId = req.headers.get('x-company-id');
  if (!companyId) return fail('INVALID_CONTEXT', '缺少企业上下文', 400);
  const { error } = await requireCompanyMember(user, companyId, 'VIEWER');
  if (error) return error;
  const page = Math.max(1, Number(req.nextUrl.searchParams.get('page')) || 1);
  const pageSize = Math.min(50, Math.max(1, Number(req.nextUrl.searchParams.get('pageSize')) || 20));
  const [total, items] = await Promise.all([
    prisma.payment.count({ where: { company_id: companyId } }),
    prisma.payment.findMany({
      where: { company_id: companyId },
      orderBy: { created_at: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { plan: { select: { id: true, name: true } } },
    }),
  ]);
  return ok(items, { total, page, pageSize });
}

/** 创建支付订单（套餐订阅） */
export async function POST(req: NextRequest) {
  const user = await getUserFromRequest();
  if (!user) return fail('UNAUTHORIZED', '未登录', 401);
  const companyId = req.headers.get('x-company-id');
  if (!companyId) return fail('INVALID_CONTEXT', '缺少企业上下文', 400);
  const { error } = await requireCompanyMember(user, companyId, 'OWNER');
  if (error) return error;

  const cfg = await getSiteConfig();
  if (!cfg.payment_enabled) return fail('PAYMENT_DISABLED', '支付功能已关闭');

  const parsed = createPaymentSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return fail('VALIDATION_ERROR', parsed.error.issues[0]?.message || '参数错误');

  try {
    const result = await createPayment({ companyId, planId: parsed.data.plan_id, channel: parsed.data.channel });
    return ok(result);
  } catch (e) {
    return handleError(e);
  }
}
