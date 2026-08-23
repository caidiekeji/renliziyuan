import { NextRequest } from 'next/server';
import { ok, fail, handleError, getClientIp } from '@/lib/api/response';
import { registerSchema } from '@/lib/validators/zod';
import { verifyCode } from '@/lib/sms';
import { prisma } from '@/lib/db/prisma';
import { signAccessToken, signRefreshToken } from '@/lib/auth/jwt';
import { setSessionCookies } from '@/lib/auth/session';
import { getSiteConfig } from '@/lib/config';
import { sha256 } from '@/lib/crypto';
import { globalRateLimit } from '@/lib/middleware/rate-limit';
import bcrypt from 'bcryptjs';

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  if (!(await globalRateLimit(ip, '/api/auth/register', 'POST')))
    return fail('RATE_LIMITED', '请求过于频繁', 429);

  const parsed = registerSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return fail('VALIDATION_ERROR', parsed.error.issues[0]?.message || '参数错误');
  const { phone, code, name, password, role, agree_terms, agree_privacy } = parsed.data;

  const cfg = await getSiteConfig();
  if (!cfg.register_enabled) return fail('REGISTER_DISABLED', '平台暂停注册');

  // 验证码校验（sms_enabled 关闭时跳过，开发阶段可免验证码注册）
  if (cfg.sms_enabled !== false) {
    const codeOk = await verifyCode(phone, code, 'LOGIN');
    if (!codeOk) return fail('INVALID_CODE', '验证码错误或已过期');
  }

  // 回收池检查：注销后 7 天内不可注册
  const pool = await prisma.phoneReleasePool.findFirst({ where: { phone } });
  if (pool) return fail('PHONE_IN_RELEASE_POOL', '该手机号注销后 7 天内不可重新注册');

  const existing = await prisma.user.findUnique({ where: { phone } });
  if (existing && existing.status !== 'DELETED') return fail('PHONE_EXISTS', '该手机号已注册');

  try {
    const passwordHash = password ? await bcrypt.hash(password, 10) : undefined;
    const user = existing
      ? await prisma.user.update({
          where: { id: existing.id },
          data: { name, password_hash: passwordHash, role, status: 'ACTIVE', deleted_at: null },
        })
      : await prisma.user.create({
          data: { phone, name, role, password_hash: passwordHash, skills: [] },
        });

    // 记录条款同意（terms + privacy）
    for (const key of ['terms', 'privacy']) {
      const policy = await prisma.policy.findFirst({ where: { key, status: 'PUBLISHED' }, orderBy: { version: 'desc' } });
      if (policy) {
        await prisma.userPolicyAgreement.create({
          data: {
            user_id: user.id,
            policy_key: key,
            policy_id: policy.id,
            version: policy.version,
            content_hash: sha256(policy.content),
            agreed_at: new Date(),
            ip,
            user_agent: req.headers.get('user-agent')?.slice(0, 300) || undefined,
            source: 'REGISTER',
          },
        });
      }
    }
    if (!agree_terms || !agree_privacy) return fail('AGREEMENT_REQUIRED', '必须同意用户协议与隐私政策');

    const res = ok({ user: publicUser(user) });
    const [access, refresh] = await Promise.all([
      signAccessToken(user.id, user.refresh_token_version, user.role),
      signRefreshToken(user.id, user.refresh_token_version),
    ]);
    setSessionCookies(res, access, refresh);
    return res;
  } catch (e) {
    return handleError(e);
  }
}

function publicUser(u: any) {
  return { id: u.id, phone: u.phone, name: u.name, avatar: u.avatar, role: u.role, status: u.status };
}
