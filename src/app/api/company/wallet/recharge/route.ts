import { NextRequest } from 'next/server';
import { created, fail, handleError } from '@/lib/api/response';
import { getUserFromRequest, requireCompanyMember } from '@/lib/auth/session';
import { createRechargePayment } from '@/lib/payment';
import type { PaymentChannel } from '@prisma/client';

export const dynamic = 'force-dynamic';

/** 企业余额充值：金额 10~10000 元，创建支付订单 */
export async function POST(req: NextRequest) {
  const user = await getUserFromRequest();
  if (!user) return fail('UNAUTHORIZED', '未登录', 401);
  const companyId = req.headers.get('x-company-id');
  if (!companyId) return fail('INVALID_CONTEXT', '缺少企业上下文', 400);
  const { error } = await requireCompanyMember(user, companyId, 'HR');
  if (error) return error;

  const body = await req.json().catch(() => ({}));
  const amount = Number(body.amount);
  const channel = body.channel as PaymentChannel;
  if (!Number.isFinite(amount) || amount < 10 || amount > 10000)
    return fail('INVALID_AMOUNT', '充值金额需在 10~10000 元之间', 400);
  if (!['ALIPAY', 'WECHAT'].includes(channel))
    return fail('INVALID_CHANNEL', '支付渠道无效');

  try {
    const order = await createRechargePayment({ companyId, amount: Math.round(amount * 100) / 100, channel });
    return created(order);
  } catch (e) {
    return handleError(e);
  }
}
