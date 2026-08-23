import crypto from 'crypto';
import type { PaymentGateway } from './gateway';
import { decryptPaymentConfig } from './gateway';

/**
 * 微信支付 V3 —— Native 扫码支付
 * 参考官方文档：https://pay.weixin.qq.com/docs/merchant/apis/native-payment/...
 * 商户 API 私钥/证书序列号在后台「支付配置」中维护，密钥已 AES 加密存储。
 */
export const WechatPay: PaymentGateway = {
  channel: 'WECHAT',

  async createOrder({ orderNo, amount, subject, config, notifyUrl }) {
    const { merchant_id: mchid, app_secret_enc: apiKey, cert_serial: serialNo, gateway_url } = decryptPaymentConfig(config);
    if (!apiKey || !serialNo) throw new Error('微信支付配置不完整（缺少 APIv3 密钥或证书序列号）');
    const base = gateway_url || 'https://api.mch.weixin.qq.com';
    const path = '/v3/pay/transactions/native';
    const body = JSON.stringify({
      appid: process.env.WECHAT_APPID || '',
      mchid,
      description: subject,
      out_trade_no: orderNo,
      notify_url: notifyUrl,
      amount: { total: Math.round(amount * 100), currency: 'CNY' },
    });
    const auth = await buildAuth('POST', path, body, apiKey, mchid, serialNo);
    const res = await fetch(`${base}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: auth },
      body,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(`微信支付下单失败: ${data?.message || res.status}`);
    return { payUrl: data.code_url, raw: data };
  },

  async queryOrder(orderNo, config) {
    const { merchant_id: mchid, app_secret_enc: apiKey, cert_serial: serialNo, gateway_url } = decryptPaymentConfig(config);
    if (!apiKey || !serialNo) throw new Error('微信支付配置不完整');
    const base = gateway_url || 'https://api.mch.weixin.qq.com';
    const path = `/v3/pay/transactions/out-trade-no/${encodeURIComponent(orderNo)}?mchid=${mchid}`;
    const auth = await buildAuth('GET', path, '', apiKey, mchid, serialNo);
    const res = await fetch(`${base}${path}`, { method: 'GET', headers: { Authorization: auth } });
    const data = await res.json();
    if (!res.ok) throw new Error(`查询订单失败: ${data?.message || res.status}`);
    return { paid: data.trade_state === 'SUCCESS', raw: data };
  },

  async verifyCallback(headers, body) {
    const { getPaymentConfig } = await import('@/lib/payment/gateway');
    const cfg = await getPaymentConfig('WECHAT');
    if (!cfg) return { ok: false };
    const { platform_cert_enc, app_secret_enc } = decryptPaymentConfig(cfg);
    if (!platform_cert_enc || !app_secret_enc) return { ok: false };
    const timestamp = headers['wechatpay-timestamp'];
    const nonce = headers['wechatpay-nonce'];
    const signature = headers['wechatpay-signature'];
    if (!timestamp || !nonce || !signature) return { ok: false };
    const message = `${timestamp}\n${nonce}\n${body}\n`;
    const verifier = crypto.createVerify('RSA-SHA256');
    verifier.update(message);
    const valid = verifier.verify(platform_cert_enc, signature, 'base64');
    if (!valid) return { ok: false };
    // 解密 resource（AES-256-GCM，密文末尾 16 字节为认证标签）
    try {
      const resource = JSON.parse(body).resource;
      const ciphertext = Buffer.from(resource.ciphertext, 'base64');
      const tag = ciphertext.subarray(ciphertext.length - 16);
      const data = ciphertext.subarray(0, ciphertext.length - 16);
      const dec = crypto.createDecipheriv('aes-256-gcm', Buffer.from(app_secret_enc, 'utf8'), Buffer.from(resource.nonce, 'utf8'));
      dec.setAAD(Buffer.from(resource.associated_data || ''));
      dec.setAuthTag(tag);
      const plain = Buffer.concat([dec.update(data), dec.final()]).toString('utf8');
      const parsed = JSON.parse(plain);
      return { ok: true, orderNo: parsed.out_trade_no };
    } catch {
      return { ok: false };
    }
  },

  async refund(orderNo, amount, config) {
    const { merchant_id: mchid, app_secret_enc: apiKey, cert_serial: serialNo, gateway_url } = decryptPaymentConfig(config);
    if (!apiKey || !serialNo) throw new Error('微信支付配置不完整');
    const base = gateway_url || 'https://api.mch.weixin.qq.com';
    const path = '/v3/refund/domestic/refunds';
    const body = JSON.stringify({
      out_trade_no: orderNo,
      out_refund_no: `RF${orderNo}`,
      amount: { refund: Math.round(amount * 100), total: Math.round(amount * 100), currency: 'CNY' },
    });
    const auth = await buildAuth('POST', path, body, apiKey, mchid, serialNo);
    const res = await fetch(`${base}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: auth },
      body,
    });
    return { ok: res.ok };
  },
};

/** 构建微信支付 JWS 签名 Authorization 头 */
export async function buildAuth(
  method: string,
  apiPath: string,
  body: string,
  apiKey: string, // 商户 APIv3 密钥（32 字符）
  mchid: string,
  serialNo: string
): Promise<string> {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = crypto.randomBytes(16).toString('hex');
  const message = `${method}\n${apiPath}\n${timestamp}\n${nonce}\n${body}\n`;
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(message);
  // apiKey 此处为商户 API 私钥 PEM
  const signature = signer.sign(apiKey, 'base64');
  return `WECHATPAY2-SHA256-RSA2048 mchid="${mchid}",nonce_str="${nonce}",signature="${signature}",timestamp="${timestamp}",serial_no="${serialNo}"`;
}
