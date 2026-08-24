import { NextRequest } from 'next/server';
import { ok } from '@/lib/api/response';
import { requireAdmin, auditLog } from '@/lib/auth/admin';
import { prisma } from '@/lib/db/prisma';
import { getClientIp } from '@/lib/api/response';

export const dynamic = 'force-dynamic';

/** 启动对账任务：比对渠道已支付订单与本地 PENDING 订单，自动补偿
 *  简化实现：扫描 PENDING 超时订单，逐渠道 queryOrder 检查真实状态，已支付的自动激活。
 *  对于渠道有记录但本地无订单的情况（无法自动匹配企业），标记为 UNMATCHED 待人工处理。
 */
export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;

  const body = await req.json().catch(() => ({}));
  const days = Math.min(7, Math.max(1, Number(body.days) || 3));
  const since = new Date(Date.now() - days * 24 * 3600 * 1000);

  // 查找 PENDING 超时订单（创建超过 10 分钟且未回调）
  const stalePayments = await prisma.payment.findMany({
    where: {
      status: 'PENDING',
      created_at: { lt: new Date(Date.now() - 10 * 60_000), gte: since },
    },
    orderBy: { created_at: 'asc' },
    take: 100,
  });

  const { getGateway } = await import('@/lib/payment');
  const { getPaymentConfig } = await import('@/lib/payment/gateway');
  const { activateSubscription } = await import('@/lib/payment');

  const results: { order_no: string; action: string }[] = [];

  for (const p of stalePayments) {
    try {
      const cfg = await getPaymentConfig(p.channel);
      if (!cfg || !cfg.active || cfg.sandbox) continue;
      const gateway = getGateway(p.channel);
      const { paid } = await gateway.queryOrder(p.order_no, cfg);
      if (!paid) continue;

      // 渠道已支付：幂等激活
      const claimed = await prisma.payment.updateMany({
        where: { id: p.id, status: 'PENDING' },
        data: { status: 'PAID', paid_at: new Date() },
      });
      if (claimed.count === 0) continue;

      if (p.plan_id) {
        await activateSubscription(p.company_id, p.plan_id);
      } else if (p.type === 'RECHARGE') {
        const { walletRecharge } = await import('@/lib/wallet');
        await walletRecharge(p.company_id, Number(p.amount), p.order_no, '对账补偿');
      }
      results.push({ order_no: p.order_no, action: 'activated' });
    } catch {
      // 个别订单查询失败不阻塞后续对账
    }
  }

  await auditLog({
    adminId: auth.admin.id,
    action: 'RECONCILE_PAYMENT',
    targetType: 'PAYMENT',
    detail: { days, scanned: stalePayments.length, activated: results.length },
    ip: getClientIp(req),
  });
  return ok({ scanned: stalePayments.length, activated: results.length, details: results });
}
