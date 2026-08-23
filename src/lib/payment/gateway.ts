import { prisma } from '@/lib/db/prisma';
import { decryptSecret } from '@/lib/crypto';
import type { PaymentChannel, PaymentConfig } from '@prisma/client';

/** 支付网关统一接口 */
export interface PaymentGateway {
  channel: PaymentChannel;
  /** 创建支付（返回支付二维码/跳转链接） */
  createOrder(opts: {
    orderNo: string;
    amount: number; // 元
    subject: string;
    config: PaymentConfig;
    notifyUrl: string;
  }): Promise<{ payUrl: string; raw?: unknown }>;
  /** 查询订单状态：返回是否已支付 */
  queryOrder(orderNo: string, config: PaymentConfig): Promise<{ paid: boolean; raw?: unknown }>;
  /** 校验异步回调签名，返回订单号 */
  verifyCallback(headers: Record<string, string>, body: string): Promise<{ ok: boolean; orderNo?: string }>;
  /** 退款 */
  refund(orderNo: string, amount: number, config: PaymentConfig): Promise<{ ok: boolean }>;
}

export function getPaymentConfig(channel: PaymentChannel): Promise<PaymentConfig | null> {
  return prisma.paymentConfig.findUnique({ where: { channel } });
}

/** 解密后的配置对象 */
export function decryptPaymentConfig(cfg: PaymentConfig) {
  return {
    ...cfg,
    app_secret_enc: cfg.app_secret_enc ? decryptSecret(cfg.app_secret_enc) : undefined,
    platform_cert_enc: cfg.platform_cert_enc ? decryptSecret(cfg.platform_cert_enc) : undefined,
  };
}
