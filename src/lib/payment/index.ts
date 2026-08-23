import { prisma } from '@/lib/db/prisma';
import { nanoid } from 'nanoid';
import type { PaymentChannel } from '@prisma/client';
import { getPaymentConfig, type PaymentGateway } from './gateway';
import { WechatPay } from './wechat';
import { AlipayPay } from './alipay';
import { MockPay } from './mock';
import { enqueue } from '@/lib/queue';
import { log } from '@/lib/logger';

const GATEWAYS: Record<PaymentChannel, PaymentGateway> = {
  WECHAT: WechatPay,
  ALIPAY: AlipayPay,
  STRIPE: MockPay,
};

export function getGateway(channel: PaymentChannel): PaymentGateway {
  return GATEWAYS[channel] ?? MockPay;
}

/** 是否为开发模拟网关（未配置有效支付配置时） */
export async function isMockMode(channel: PaymentChannel): Promise<boolean> {
  const cfg = await getPaymentConfig(channel);
  return !cfg || !cfg.active || cfg.sandbox === true;
}

export function genOrderNo(): string {
  return `JB${Date.now()}${nanoid(8).toUpperCase()}`;
}

/**
 * 创建支付订单：生成 order_no、落库 Payment(PENDING)、调用网关获取二维码
 */
export async function createPayment(params: {
  companyId: string;
  planId: string;
  channel: PaymentChannel;
}) {
  const { companyId, planId, channel } = params;
  const plan = await prisma.plan.findUnique({ where: { id: planId } });
  if (!plan || !plan.active) throw new Error('套餐不存在或已停用');
  const price = plan.price_monthly ?? 0;
  if (Number(price) <= 0) {
    // 免费套餐：直接开通
    await activateSubscription(companyId, plan.id);
    return { orderNo: null, payUrl: null, amount: 0 };
  }

  const cfg = await getPaymentConfig(channel);
  const orderNo = genOrderNo();
  await prisma.payment.create({
    data: {
      order_no: orderNo,
      company_id: companyId,
      plan_id: plan.id,
      amount: price,
      channel,
      status: 'PENDING',
    },
  });

  const gateway = getGateway(channel);
  const notifyUrl = `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/payments/callback/${channel.toLowerCase()}`;
  const { payUrl } = await gateway.createOrder({
    orderNo,
    amount: Number(price),
    subject: `${plan.name}套餐订阅`,
    config: cfg!,
    notifyUrl,
  });
  return { orderNo, payUrl, amount: Number(price) };
}

/**
 * 创建企业余额充值订单（金额 10~10000 元，由调用方校验）
 */
export async function createRechargePayment(params: { companyId: string; amount: number; channel: PaymentChannel }) {
  const { companyId, amount, channel } = params;
  const cfg = await getPaymentConfig(channel);
  const orderNo = genOrderNo();
  await prisma.payment.create({
    data: {
      order_no: orderNo,
      company_id: companyId,
      type: 'RECHARGE',
      amount,
      channel,
      status: 'PENDING',
      note: '企业余额充值',
    },
  });
  const gateway = getGateway(channel);
  const notifyUrl = `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/payments/callback/${channel.toLowerCase()}`;
  const { payUrl } = await gateway.createOrder({
    orderNo,
    amount,
    subject: '企业余额充值',
    config: cfg!,
    notifyUrl,
  });
  return { orderNo, payUrl, amount };
}

/**
 * 订单已支付：更新状态 + 激活订阅 + 触发配额回收
 * 幂等：仅 PENDING 订单生效
 */
export async function activateSubscription(companyId: string, planId: string) {
  const plan = await prisma.plan.findUnique({ where: { id: planId } });
  if (!plan) throw new Error('套餐不存在');
  const now = new Date();
  const durationDays = plan.duration_days;
  const endAt = new Date(now.getTime() + durationDays * 24 * 3600 * 1000);

  await prisma.$transaction(async (tx) => {
    // 旧订阅过期（避免叠加）
    await tx.subscription.updateMany({
      where: { company_id: companyId, status: 'ACTIVE' },
      data: { status: 'EXPIRED' },
    });
    await tx.subscription.create({
      data: { company_id: companyId, plan_id: plan.id, status: 'ACTIVE', start_at: now, end_at: endAt },
    });
  });

  // 异步配额回收
  await enqueue.recycleJobs(companyId, plan.id).catch((e) => log('warn', 'enqueue-recycle-failed', { companyId, error: e?.message }));
  return { endAt, plan };
}

/**
 * 处理支付回调（网关校验通过后调用）
 * SUBSCRIPTION → 激活订阅；RECHARGE → 充值入账 + 自动恢复暂停置顶
 * 幂等：用 updateMany 原子占用 PENDING，只有一个并发回调能成功，其余跳过，避免重复入账。
 */
export async function handlePaymentCallback(orderNo: string) {
  const payment = await prisma.payment.findUnique({ where: { order_no: orderNo } });
  if (!payment) return null;
  // 原子 PENDING→PAID：仅首个回调能拿到 count=1
  const claimed = await prisma.payment.updateMany({
    where: { id: payment.id, status: 'PENDING' },
    data: { status: 'PAID', paid_at: new Date() },
  });
  if (claimed.count === 0) return prisma.payment.findUnique({ where: { order_no: orderNo } });

  if (payment.type === 'RECHARGE') {
    await handleRechargeSettled(payment.company_id, Number(payment.amount), orderNo);
  } else {
    await activateSubscription(payment.company_id, payment.plan_id!);
  }
  return prisma.payment.findUnique({ where: { order_no: orderNo } });
}

/** 充值入账：余额增加 + 交易流水 + 自动恢复 PAUSED 置顶 */
async function handleRechargeSettled(companyId: string, amount: number, orderNo: string) {
  const { walletRecharge } = await import('@/lib/wallet');
  const { resumePausedBoosts } = await import('@/lib/boost');
  await walletRecharge(companyId, amount, orderNo, '企业余额充值');
  await resumePausedBoosts(companyId).catch((e) => log('warn', 'recharge-resume-boost-failed', { companyId, error: e?.message }));
}

/**
 * 退款：原子占用 PAID→REFUNDED（并发/重试仅一次生效）+ 幂等回滚资产 + 网关退款
 * 任一步失败回退状态为 PAID 便于重试；资产回滚以 order_no 判重，重试不会重复扣减。
 */
export async function refundPayment(paymentId: string) {
  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!payment || payment.status !== 'PAID') throw new Error('订单不可退款');

  // 原子占用 PAID→REFUNDED：并发双击/重复调用仅一次通过
  const claimed = await prisma.payment.updateMany({
    where: { id: payment.id, status: 'PAID' },
    data: { status: 'REFUNDED' },
  });
  if (claimed.count === 0) throw new Error('订单不可退款');

  try {
    // 幂等回滚业务资产：已存在该订单 REFUND 流水则跳过（网关失败重试不重复扣）
    const refunded = await prisma.walletTransaction.findFirst({
      where: { company_id: payment.company_id, order_no: payment.order_no, type: 'REFUND' },
      select: { id: true },
    });
    if (payment.type === 'RECHARGE') {
      if (!refunded) {
        const { walletRefund } = await import('@/lib/wallet');
        await walletRefund(payment.company_id, Number(payment.amount), payment.order_no, '充值退款');
      }
    } else if (payment.plan_id) {
      // updateMany 天然幂等：已取消则无操作
      await prisma.subscription.updateMany({
        where: { company_id: payment.company_id, plan_id: payment.plan_id, status: 'ACTIVE' },
        data: { status: 'CANCELLED' },
      });
    }

    const cfg = await getPaymentConfig(payment.channel);
    if (cfg) {
      await getGateway(payment.channel).refund(payment.order_no, Number(payment.amount), cfg);
    }
    return payment;
  } catch (e) {
    // 回退状态便于管理员重试（资产回滚已幂等，重试安全）
    await prisma.payment.update({ where: { id: payment.id }, data: { status: 'PAID' } }).catch(() => undefined);
    throw e;
  }
}
