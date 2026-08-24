import { NextRequest } from 'next/server';
import { ok, fail } from '@/lib/api/response';
import { requireAdmin, auditLog } from '@/lib/auth/admin';
import { prisma } from '@/lib/db/prisma';
import { getClientIp } from '@/lib/api/response';

export const dynamic = 'force-dynamic';

/** 异常订单补单（admin）：将 PENDING 超时订单标记为 FAILED，将渠道已支付但本地异常的订单手动修正 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const action = body.action === 'markFailed' ? 'markFailed' : body.action === 'activate' ? 'activate' : '';

  const payment = await prisma.payment.findUnique({ where: { id } });
  if (!payment) return fail('PAYMENT_NOT_FOUND', '订单不存在', 404);

  if (action === 'markFailed') {
    if (payment.status !== 'PENDING') return fail('INVALID_STATUS', '仅 PENDING 状态可标记失败');
    await prisma.payment.update({ where: { id }, data: { status: 'FAILED' } });
    await auditLog({ adminId: auth.admin.id, action: 'RECONCILE_MARK_FAILED', targetType: 'PAYMENT', targetId: id, detail: { order_no: payment.order_no }, ip: getClientIp(req) });
    return ok({ success: true, status: 'FAILED' });
  }

  if (action === 'activate') {
    // 渠道已支付但回调丢失，手动激活
    if (payment.status !== 'PENDING') return fail('INVALID_STATUS', '仅 PENDING 状态可补单激活');
    if (!payment.plan_id) return fail('INVALID_ORDER', '非订阅订单，请使用充值补单流程');
    const { activateSubscription } = await import('@/lib/payment');
    await prisma.payment.update({ where: { id }, data: { status: 'PAID', paid_at: new Date() } });
    await activateSubscription(payment.company_id, payment.plan_id);
    await auditLog({ adminId: auth.admin.id, action: 'RECONCILE_ACTIVATE', targetType: 'PAYMENT', targetId: id, detail: { order_no: payment.order_no, company_id: payment.company_id }, ip: getClientIp(req) });
    return ok({ success: true, status: 'PAID' });
  }

  return fail('VALIDATION_ERROR', 'action 必须为 markFailed 或 activate');
}
