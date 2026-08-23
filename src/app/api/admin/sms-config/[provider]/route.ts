import { NextRequest } from 'next/server';
import { ok, fail, handleError, getClientIp } from '@/lib/api/response';
import { requireAdmin, auditLog } from '@/lib/auth/admin';
import { prisma } from '@/lib/db/prisma';
import { smsConfigSchema } from '@/lib/validators/zod';
import { encryptSecret } from '@/lib/crypto';

export const dynamic = 'force-dynamic';

/** 部分更新短信渠道配置（provider 取自路径参数） */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;
  const { provider } = await params;
  const parsed = smsConfigSchema.partial().safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return fail('VALIDATION_ERROR', parsed.error.issues[0]?.message || '参数错误');
  try {
    const existing = await prisma.smsConfig.findUnique({ where: { provider: provider as any } });
    if (!existing) return fail('SMS_CONFIG_NOT_FOUND', '短信渠道配置不存在', 404);
    const data = parsed.data;
    // 设为主渠道时，先取消同表其他渠道的主渠道标记
    if (data.is_primary) {
      await prisma.smsConfig.updateMany({ where: { provider: { not: provider as any } }, data: { is_primary: false } });
    }
    const update: any = { ...data };
    delete update.provider;
    if (data.secret !== undefined) update.secret_enc = data.secret ? encryptSecret(data.secret) : null;
    delete update.secret;
    const cfg = await prisma.smsConfig.update({ where: { provider: provider as any }, data: update });
    await auditLog({ adminId: auth.admin.id, action: 'UPDATE_SMS_CONFIG', targetType: 'SMS_CONFIG', targetId: cfg.id, detail: { provider }, ip: getClientIp(req) });
    return ok(cfg);
  } catch (e) {
    return handleError(e);
  }
}
