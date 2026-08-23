import { prisma } from '@/lib/db/prisma';
import { ensureRedis } from '@/lib/db/redis';
import { decryptSecret } from '@/lib/crypto';
import type { SmsConfig, SmsProviderType, SmsPurpose } from '@prisma/client';
import { AliyunSmsProvider, TencentSmsProvider, VolcengineSmsProvider } from './provider';
import { log } from '@/lib/logger';

/** 内存计数器：Redis 不可用时的降级限流（每手机号独立计数，进程重启归零） */
const memCounter = new Map<string, { minute: number; hour: number; day: number; minuteAt: number; hourAt: number; dayAt: number }>();
function memIncr(key: string, windowMs: number): number {
  const now = Date.now();
  const e = memCounter.get(key);
  if (!e || now - e.minuteAt >= windowMs) {
    memCounter.set(key, { minute: 1, hour: e?.hour || 0, day: e?.day || 0, minuteAt: now, hourAt: e?.hourAt || now, dayAt: e?.dayAt || now });
    return 1;
  }
  e.minute++;
  return e.minute;
}
function memIncrWindow(key: string, windowSec: number, field: 'hour' | 'day'): number {
  const now = Date.now();
  const e = memCounter.get(key);
  if (!e) { memCounter.set(key, { minute: 0, hour: 1, day: 1, minuteAt: now, hourAt: now, dayAt: now }); return 1; }
  const elapsed = field === 'hour' ? now - e.hourAt : now - e.dayAt;
  if (elapsed >= windowSec * 1000) {
    e[field] = 1;
    if (field === 'hour') e.hourAt = now; else e.dayAt = now;
    return 1;
  }
  e[field]++;
  return e[field];
}

const PROVIDERS: Record<SmsProviderType, typeof AliyunSmsProvider> = {
  ALIYUN: AliyunSmsProvider,
  TENCENT: TencentSmsProvider,
  VOLCENGINE: VolcengineSmsProvider,
};

export function generateCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

/** 选择当前启用的短信服务商（优先主服务商，失败可切换） */
async function pickProvider(): Promise<SmsConfig | null> {
  const all = await prisma.smsConfig.findMany({ where: { enabled: true } });
  if (all.length === 0) return null;
  return all.find((c) => c.is_primary) ?? all[0];
}

/** 发送验证码（含限流 + 5 分钟有效期）；Redis 不可用时降级为内存限流 */
export async function sendVerificationCode(phone: string, purpose: SmsPurpose): Promise<{ ok: boolean; message: string; code?: string }> {
  // 限流：优先 Redis，不可用时降级内存计数（fail-open）
  let min = 0, hour = 0, day = 0;
  try {
    const r = await ensureRedis();
    const minuteKey = `sms:${phone}:minute`;
    const hourKey = `sms:${phone}:hour`;
    const dayKey = `sms:${phone}:day`;
    [min, hour, day] = await Promise.all([
      r.incr(minuteKey).then(async (n) => (n === 1 ? (await r.expire(minuteKey, 60), n) : n)),
      r.incr(hourKey).then(async (n) => (n === 1 ? (await r.expire(hourKey, 3600), n) : n)),
      r.incr(dayKey).then(async (n) => (n === 1 ? (await r.expire(dayKey, 86400), n) : n)),
    ]);
  } catch {
    const mk = `sms:${phone}`;
    min = memIncr(`${mk}:m`, 60_000);
    hour = memIncrWindow(`${mk}:h`, 3600, 'hour');
    day = memIncrWindow(`${mk}:d`, 86400, 'day');
  }
  if (min > 1) return { ok: false, message: '发送太频繁，请 1 分钟后再试' };
  if (hour > 5) return { ok: false, message: '本小时发送次数已达上限' };
  if (day > 10) return { ok: false, message: '今日发送次数已达上限' };

  const code = generateCode();
  const cfg = await pickProvider();
  if (!cfg || !cfg.enabled) {
    // 开发模式：未配置短信服务商
    log('info', 'sms:dev-mode', { phone, purpose, code });
    await prisma.smsCode.create({
      data: { phone, code, purpose, expire_at: new Date(Date.now() + 5 * 60_000) },
    });
    const msg = process.env.SMS_DEV_MODE === '1' ? `开发模式验证码：${code}` : '验证码已发送（系统未配置短信服务商）';
    return { ok: true, message: msg, code: process.env.SMS_DEV_MODE === '1' ? code : undefined };
  }

  const provider = PROVIDERS[cfg.provider];
  const decrypted = cfg.secret_enc ? decryptSecret(cfg.secret_enc) : undefined;
  const result = await provider.send(phone, 'login', { code }, { ...cfg, secret_enc: decrypted ?? null });

  if (!result.ok) {
    log('error', 'sms:send-failed', { phone, provider: cfg.provider, message: result.message });
    return { ok: false, message: result.message || '短信发送失败' };
  }

  await prisma.smsCode.create({
    data: { phone, code, purpose, expire_at: new Date(Date.now() + 5 * 60_000) },
  });
  return { ok: true, message: '验证码已发送' };
}

/** 校验验证码（成功后即失效；错误超 5 次作废，防爆破） */
export async function verifyCode(phone: string, code: string, purpose: SmsPurpose): Promise<boolean> {
  const row = await prisma.smsCode.findFirst({
    where: { phone, purpose, expire_at: { gt: new Date() } },
    orderBy: { created_at: 'desc' },
  });
  if (!row) return false;
  // 防爆破：同一验证码错误尝试超过 5 次即作废（需重新获取）
  if (row.attempts >= 5) return false;
  if (row.code !== code) {
    await prisma.smsCode.update({ where: { id: row.id }, data: { attempts: { increment: 1 } } });
    return false;
  }
  // 一次性验证码
  await prisma.smsCode.update({ where: { id: row.id }, data: { code: 'USED' } });
  return true;
}
