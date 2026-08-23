import { NextRequest } from 'next/server';
import { ok, fail, handleError, getClientIp } from '@/lib/api/response';
import { requireAdmin, auditLog } from '@/lib/auth/admin';
import { prisma } from '@/lib/db/prisma';
import { smsConfigSchema } from '@/lib/validators/zod';
import { encryptSecret } from '@/lib/crypto';

export const dynamic = 'force-dynamic';

/** 短信渠道配置列表（不返回加密字段） */
export async function GET() {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;
  const list = await prisma.smsConfig.findMany({ orderBy: { provider: 'asc' } });
  const items = list.map(({ secret_enc, ...rest }) => rest);
  return ok(items);
}

/** 保存短信渠道配置（按 provider upsert，secret 加密存储） */
export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;
  const parsed = smsConfigSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return fail('VALIDATION_ERROR', parsed.error.issues[0]?.message || '参数错误');
  try {
    const data = parsed.data;
    // 设为主渠道时，先取消同表其他渠道的主渠道标记
    if (data.is_primary) {
      await prisma.smsConfig.updateMany({ where: { provider: { not: data.provider } }, data: { is_primary: false } });
    }
    const update: any = {
      access_key: data.access_key,
      sign_name: data.sign_name,
      template_code_login: data.template_code_login,
      template_code_notify: data.template_code_notify,
      endpoint: data.endpoint,
      enabled: data.enabled,
      is_primary: data.is_primary,
    };
    if (data.secret !== undefined) update.secret_enc = data.secret ? encryptSecret(data.secret) : null;
    const cfg = await prisma.smsConfig.upsert({
      where: { provider: data.provider },
      update,
      create: {
        provider: data.provider,
        access_key: data.access_key,
        secret_enc: data.secret ? encryptSecret(data.secret) : null,
        sign_name: data.sign_name,
        template_code_login: data.template_code_login,
        template_code_notify: data.template_code_notify,
        endpoint: data.endpoint,
        enabled: data.enabled,
        is_primary: data.is_primary,
      },
    });
    await auditLog({ adminId: auth.admin.id, action: 'UPDATE_SMS_CONFIG', targetType: 'SMS_CONFIG', targetId: cfg.id, detail: { provider: data.provider }, ip: getClientIp(req) });
    return ok(cfg);
  } catch (e) {
    return handleError(e);
  }
}
