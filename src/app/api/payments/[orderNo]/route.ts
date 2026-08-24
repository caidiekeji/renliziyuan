import { NextRequest } from 'next/server';
import { ok, fail } from '@/lib/api/response';
import { getUserFromRequest, requireCompanyMember } from '@/lib/auth/session';
import { prisma } from '@/lib/db/prisma';
import { log } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * 取消待支付订单：仅允许订单所属企业的 OWNER 操作，且订单必须处于 PENDING。
 * 置为 FAILED 保留审计记录，不做物理删除。
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ orderNo: string }> }) {
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
  if (payment.status !== 'PENDING') return fail('INVALID_STATUS', '仅待支付订单可取消', 400);

  await prisma.payment.update({ where: { id: payment.id }, data: { status: 'FAILED' } });
  log('info', 'payment:cancelled', { orderNo, companyId });
  return ok({ success: true });
}
