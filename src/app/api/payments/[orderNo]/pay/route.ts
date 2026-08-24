import { NextRequest } from 'next/server';
import { ok, fail } from '@/lib/api/response';
import { getUserFromRequest, requireCompanyMember } from '@/lib/auth/session';
import { prisma } from '@/lib/db/prisma';
import { getAvailableChannels, getGateway } from '@/lib/payment';
import { getPaymentConfig } from '@/lib/payment/gateway';

export const dynamic = 'force-dynamic';

/**
 * 待支付订单重新发起支付：重新调用网关获取支付链接。
 * 仅允许订单所属企业的 OWNER 操作，且订单必须处于 PENDING。
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ orderNo: string }> }) {
  const user = await getUserFromRequest();
  if (!user) return fail('UNAUTHORIZED', '未登录', 401);
  const companyId = req.headers.get('x-company-id');
  if (!companyId) return fail('INVALID_CONTEXT', '缺少企业上下文', 400);
  const { orderNo } = await params;

  const payment = await prisma.payment.findUnique({ where: { order_no: orderNo } });
  if (!payment) return fail('ORDER_NOT_FOUND', '订单不存在', 404);
  if (payment.company_id !== companyId) return fail('FORBIDDEN', '无权操作该订单', 403);
  const { error } = await requireCompanyMember(user, companyId, 'OWNER');
  if (error) return error;
  if (payment.status !== 'PENDING') return fail('INVALID_STATUS', '仅待支付订单可重新支付', 400);

  // 渠道必须仍处于可用状态（已停用/未配置则不可支付）
  const available = await getAvailableChannels();
  if (!available.some((c) => c.channel === payment.channel)) return fail('CHANNEL_UNAVAILABLE', '支付渠道已停用或未配置', 400);

  const cfg = await getPaymentConfig(payment.channel);
  const notifyUrl = `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/payments/callback/${payment.channel.toLowerCase()}`;
  const gateway = getGateway(payment.channel);
  const subject = payment.type === 'RECHARGE' ? '企业余额充值' : '套餐订阅';
  const { payUrl } = await gateway.createOrder({
    orderNo: payment.order_no,
    amount: Number(payment.amount),
    subject,
    config: cfg!,
    notifyUrl,
  });
  return ok({ pay_url: payUrl });
}
