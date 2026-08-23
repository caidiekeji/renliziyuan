import type { PaymentGateway } from './gateway';
import { decryptPaymentConfig } from './gateway';

/**
 * 开发/沙箱模拟网关：不真实扣款，返回可访问的模拟支付二维码 URL。
 * 生产环境在「支付配置」中关闭 sandbox 并切换到真实网关。
 */
export const MockPay: PaymentGateway = {
  channel: 'STRIPE', // 占位

  async createOrder({ orderNo, amount, subject, config, notifyUrl }) {
    const { gateway_url } = decryptPaymentConfig(config);
    const base = gateway_url || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
    // 模拟支付页：展示金额，点击后模拟回调完成
    const payUrl = `${base}/pay/mock/${orderNo}?amount=${amount}&subject=${encodeURIComponent(subject)}&notify=${encodeURIComponent(notifyUrl)}`;
    return { payUrl };
  },

  async queryOrder() {
    return { paid: false }; // 模拟网关不主动查询，由回调完成
  },

  async verifyCallback() {
    return { ok: true };
  },

  async refund() {
    return { ok: true };
  },
};
