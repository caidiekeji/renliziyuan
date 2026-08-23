import { NextRequest } from 'next/server';
import { ok, fail, handleError, getClientIp } from '@/lib/api/response';
import { requireAdmin, auditLog } from '@/lib/auth/admin';
import { prisma } from '@/lib/db/prisma';
import { paymentConfigSchema } from '@/lib/validators/zod';
import { encryptSecret } from '@/lib/crypto';

export const dynamic = 'force-dynamic';

/** 部分更新支付渠道配置（channel 取自路径参数） */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ channel: string }> }) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;
  const { channel } = await params;
  const parsed = paymentConfigSchema.partial().safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return fail('VALIDATION_ERROR', parsed.error.issues[0]?.message || '参数错误');
  try {
    const existing = await prisma.paymentConfig.findUnique({ where: { channel: channel as any } });
    if (!existing) return fail('PAYMENT_CONFIG_NOT_FOUND', '支付渠道配置不存在', 404);
    const data = parsed.data;
    const update: any = { ...data };
    delete update.channel;
    if (data.secret !== undefined) update.app_secret_enc = data.secret ? encryptSecret(data.secret) : null;
    if (data.platform_cert !== undefined) update.platform_cert_enc = data.platform_cert ? encryptSecret(data.platform_cert) : null;
    delete update.secret;
    delete update.platform_cert;
    const cfg = await prisma.paymentConfig.update({ where: { channel: channel as any }, data: update });
    await auditLog({ adminId: auth.admin.id, action: 'UPDATE_PAYMENT_CONFIG', targetType: 'PAYMENT_CONFIG', targetId: cfg.id, detail: { channel }, ip: getClientIp(req) });
    return ok(cfg);
  } catch (e) {
    return handleError(e);
  }
}
