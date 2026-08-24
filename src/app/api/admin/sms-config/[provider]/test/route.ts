import { NextRequest } from 'next/server';
import { ok, fail } from '@/lib/api/response';
import { requireAdmin, auditLog } from '@/lib/auth/admin';
import { prisma } from '@/lib/db/prisma';
import { decryptSecret } from '@/lib/crypto';
import { getClientIp } from '@/lib/api/response';
import { AliyunSmsProvider, TencentSmsProvider, VolcengineSmsProvider } from '@/lib/sms/provider';

export const dynamic = 'force-dynamic';

const PROVIDERS = { ALIYUN: AliyunSmsProvider, TENCENT: TencentSmsProvider, VOLCENGINE: VolcengineSmsProvider } as const;

/** 发送测试短信验证渠道配置 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;
  const { provider } = await params;
  const body = await req.json().catch(() => ({}));
  const phone = typeof body?.phone === 'string' ? body.phone : '';
  if (!/^1[3-9]\d{9}$/.test(phone)) return fail('VALIDATION_ERROR', '手机号格式不正确');

  const cfg = await prisma.smsConfig.findUnique({ where: { provider: provider as any } });
  if (!cfg) return fail('SMS_CONFIG_NOT_FOUND', '短信渠道配置不存在', 404);
  const providerImpl = PROVIDERS[provider as keyof typeof PROVIDERS];
  if (!providerImpl) return fail('SMS_CONFIG_NOT_FOUND', '不支持的短信渠道');

  const config = { ...cfg, secret_enc: cfg.secret_enc ? decryptSecret(cfg.secret_enc) : null };
  const result = await providerImpl.send(phone, 'notify', { content: '【职桥】短信服务配置测试' }, config);
  if (!result.ok) return fail('SMS_SEND_FAILED', result.message || '短信发送失败');

  await auditLog({ adminId: auth.admin.id, action: 'TEST_SMS', targetType: 'SMS_CONFIG', targetId: cfg.id, detail: { provider, phone }, ip: getClientIp(req) });
  return ok({ success: true });
}
