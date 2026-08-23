import { NextRequest } from 'next/server';
import { ok, fail } from '@/lib/api/response';
import { requireAdmin, auditLog } from '@/lib/auth/admin';
import { refundPayment } from '@/lib/payment';
import { getClientIp } from '@/lib/api/response';

export const dynamic = 'force-dynamic';

/** 支付退款 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;
  const { id } = await params;
  try {
    const payment = await refundPayment(id);
    await auditLog({ adminId: auth.admin.id, action: 'REFUND_PAYMENT', targetType: 'PAYMENT', targetId: id, detail: { order_no: payment.order_no }, ip: getClientIp(req) });
    return ok({ status: payment.status });
  } catch (e: any) {
    return fail('REFUND_FAILED', e?.message || '退款失败');
  }
}
