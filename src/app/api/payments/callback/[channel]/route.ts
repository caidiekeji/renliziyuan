import { NextRequest } from 'next/server';
import { getGateway, handlePaymentCallback } from '@/lib/payment';
import { log } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/** 支付异步回调（微信/支付宝） */
export async function POST(req: NextRequest, { params }: { params: Promise<{ channel: string }> }) {
  const { channel } = await params;
  const raw = await req.text();
  const headers: Record<string, string> = {};
  req.headers.forEach((v, k) => (headers[k.toLowerCase()] = v));

  const gateway = getGateway(channel.toUpperCase() as any);
  try {
    const result = await gateway.verifyCallback(headers, raw);
    if (!result.ok || !result.orderNo) {
      return new Response('FAIL', { status: 200 });
    }
    const payment = await handlePaymentCallback(result.orderNo);
    log('info', 'payment:callback-handled', { orderNo: result.orderNo, status: payment?.status });
    // 微信期望 SUCCESS；支付宝期望 success
    if (channel === 'wechat') return new Response('SUCCESS', { status: 200 });
    return new Response('success', { status: 200 });
  } catch (e: any) {
    log('error', 'payment:callback-error', { channel, error: e?.message });
    return new Response('FAIL', { status: 200 });
  }
}
