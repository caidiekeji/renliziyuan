import { NextRequest } from 'next/server';
import { ok, fail } from '@/lib/api/response';
import { handlePaymentCallback, isMockMode } from '@/lib/payment';
import { getUserFromRequest, requireCompanyMember } from '@/lib/auth/session';
import { prisma } from '@/lib/db/prisma';
import { log } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * 开发模式模拟支付完成回调（仅沙箱/未配置真实网关时启用）
 * 由 /pay/mock/[orderNo] 页面触发，模拟用户扫码支付成功
 */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ orderNo: string }> }) {
  const user = await getUserFromRequest();
  if (!user) return fail('UNAUTHORIZED', '未登录', 401);
  const { orderNo } = await params;
  const payment = await prisma.payment.findUnique({ where: { order_no: orderNo } });
  if (!payment) return fail('ORDER_NOT_FOUND', '订单不存在', 404);
  // 归属校验：仅订单所属企业管理员可模拟完成，防止替他人订单入账
  const { error } = await requireCompanyMember(user, payment.company_id, 'HR');
  if (error) return error;
  // 仅允许未支付订单
  if (payment.status !== 'PENDING') return ok({ status: payment.status });
  // 仅允许模拟网关（STRIPE）且处于模拟模式（未配置/沙箱）
  if (payment.channel !== 'STRIPE') return fail('NOT_MOCKABLE', '该订单非模拟支付渠道', 403);
  if (!(await isMockMode(payment.channel))) return fail('NOT_MOCKABLE', '真实支付渠道不可模拟完成', 403);

  const updated = await handlePaymentCallback(orderNo);
  log('info', 'payment:mock-completed', { orderNo, status: updated?.status });
  return ok({ status: updated?.status });
}
