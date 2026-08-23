import { NextRequest } from 'next/server';
import { ok, fail, handleError, getClientIp } from '@/lib/api/response';
import { requireAdmin, auditLog } from '@/lib/auth/admin';
import { prisma } from '@/lib/db/prisma';
import { paymentConfigSchema } from '@/lib/validators/zod';
import { encryptSecret } from '@/lib/crypto';

export const dynamic = 'force-dynamic';

/** 支付渠道配置列表（不返回加密字段） */
export async function GET() {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;
  const list = await prisma.paymentConfig.findMany({ orderBy: { channel: 'asc' } });
  const items = list.map(({ app_secret_enc, platform_cert_enc, ...rest }) => rest);
  return ok(items);
}

/** 保存支付渠道配置（按 channel upsert，secret 加密存储） */
export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;
  const parsed = paymentConfigSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return fail('VALIDATION_ERROR', parsed.error.issues[0]?.message || '参数错误');
  try {
    const data = parsed.data;
    const update: any = {
      merchant_id: data.merchant_id,
      cert_serial: data.cert_serial,
      gateway_url: data.gateway_url,
      sandbox: data.sandbox,
      active: data.active,
    };
    if (data.secret !== undefined) update.app_secret_enc = data.secret ? encryptSecret(data.secret) : null;
    if (data.platform_cert !== undefined) update.platform_cert_enc = data.platform_cert ? encryptSecret(data.platform_cert) : null;
    const cfg = await prisma.paymentConfig.upsert({
      where: { channel: data.channel },
      update,
      create: {
        channel: data.channel,
        merchant_id: data.merchant_id,
        app_secret_enc: data.secret ? encryptSecret(data.secret) : null,
        cert_serial: data.cert_serial,
        platform_cert_enc: data.platform_cert ? encryptSecret(data.platform_cert) : null,
        gateway_url: data.gateway_url,
        sandbox: data.sandbox,
        active: data.active,
      },
    });
    await auditLog({ adminId: auth.admin.id, action: 'UPDATE_PAYMENT_CONFIG', targetType: 'PAYMENT_CONFIG', targetId: cfg.id, detail: { channel: data.channel }, ip: getClientIp(req) });
    return ok(cfg);
  } catch (e) {
    return handleError(e);
  }
}
