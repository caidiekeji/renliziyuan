import crypto from 'crypto';
import type { PaymentGateway } from './gateway';
import { decryptPaymentConfig } from './gateway';

/**
 * 支付宝 —— 当面付（扫码 precreate），RSA2 签名
 * 参考：https://opendocs.alipay.com/open/194/105072
 */
export const AlipayPay: PaymentGateway = {
  channel: 'ALIPAY',

  async createOrder({ orderNo, amount, subject, config, notifyUrl }) {
    const { merchant_id: appId, app_secret_enc: privateKey, gateway_url } = decryptPaymentConfig(config);
    if (!appId || !privateKey) throw new Error('支付宝配置不完整');
    const gateway = gateway_url || 'https://openapi.alipay.com/gateway.do';
    const bizContent = JSON.stringify({
      out_trade_no: orderNo,
      total_amount: amount.toFixed(2),
      subject,
      product_code: 'FACE_TO_FACE_PAYMENT',
    });
    const params: Record<string, string> = {
      app_id: appId,
      method: 'alipay.trade.precreate',
      charset: 'utf-8',
      sign_type: 'RSA2',
      timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),
      version: '1.0',
      notify_url: notifyUrl,
      biz_content: bizContent,
    };
    params.sign = signAlipay(params, privateKey);
    const query = new URLSearchParams(params).toString();
    const res = await fetch(`${gateway}?${query}`, { method: 'POST', body: '' });
    const text = await res.text();
    // 解析 XML 或 JSON 响应
    const qr = extractQrCode(text);
    if (!qr) throw new Error('支付宝下单失败，未获取二维码');
    return { payUrl: qr, raw: text };
  },

  async queryOrder(orderNo, config) {
    const { merchant_id: appId, app_secret_enc: privateKey, gateway_url } = decryptPaymentConfig(config);
    if (!appId || !privateKey) throw new Error('支付宝配置不完整');
    const gateway = gateway_url || 'https://openapi.alipay.com/gateway.do';
    const params: Record<string, string> = {
      app_id: appId,
      method: 'alipay.trade.query',
      charset: 'utf-8',
      sign_type: 'RSA2',
      timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),
      version: '1.0',
      biz_content: JSON.stringify({ out_trade_no: orderNo }),
    };
    params.sign = signAlipay(params, privateKey);
    const res = await fetch(`${gateway}?${new URLSearchParams(params).toString()}`);
    const text = await res.text();
    return { paid: /TRADE_SUCCESS/.test(text) && !/WAIT_BUYER_PAY/.test(text), raw: text };
  },

  async verifyCallback(headers, body) {
    const { getPaymentConfig } = await import('@/lib/payment/gateway');
    const cfg = await getPaymentConfig('ALIPAY');
    if (!cfg) return { ok: false };
    const { app_secret_enc } = decryptPaymentConfig(cfg);
    if (!app_secret_enc) return { ok: false };
    // 支付宝异步通知为 form-urlencoded；headers 的 content-type 判断
    try {
      const form = parseQuery(body);
      if (form.trade_status !== 'TRADE_SUCCESS') return { ok: false };
      const sign = form.sign;
      delete form.sign;
      delete form.sign_type;
      const content = Object.keys(form)
        .filter((k) => form[k] !== '' && form[k] !== undefined)
        .sort()
        .map((k) => `${k}=${form[k]}`)
        .join('&');
      const verifier = crypto.createVerify('RSA-SHA256');
      verifier.update(content);
      const valid = verifier.verify(app_secret_enc, sign, 'base64');
      return valid ? { ok: true, orderNo: form.out_trade_no } : { ok: false };
    } catch {
      return { ok: false };
    }
  },

  async refund(orderNo, amount, config) {
    const { merchant_id: appId, app_secret_enc: privateKey, gateway_url } = decryptPaymentConfig(config);
    if (!appId || !privateKey) throw new Error('支付宝配置不完整');
    const gateway = gateway_url || 'https://openapi.alipay.com/gateway.do';
    const params: Record<string, string> = {
      app_id: appId,
      method: 'alipay.trade.refund',
      charset: 'utf-8',
      sign_type: 'RSA2',
      timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),
      version: '1.0',
      biz_content: JSON.stringify({ out_trade_no: orderNo, refund_amount: amount.toFixed(2) }),
    };
    params.sign = signAlipay(params, privateKey);
    const res = await fetch(`${gateway}?${new URLSearchParams(params).toString()}`);
    return { ok: res.ok };
  },
};

function signAlipay(params: Record<string, string>, privateKey: string): string {
  const content = Object.keys(params)
    .filter((k) => params[k] !== '' && params[k] !== undefined)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('&');
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(content);
  return signer.sign(privateKey, 'base64');
}

function parseQuery(body: string): Record<string, string> {
  const out: Record<string, string> = {};
  new URLSearchParams(body).forEach((v, k) => (out[k] = v));
  return out;
}

/** 从支付宝响应文本提取 code_url（JSON 或 XML） */
function extractQrCode(text: string): string | null {
  try {
    const json = JSON.parse(text);
    const qr = json.alipay_trade_precreate_response?.qr_code;
    if (qr) return qr;
  } catch {
    // 可能是 XML
  }
  const m = text.match(/<qr_code>([^<]+)<\/qr_code>/);
  return m ? m[1] : null;
}
