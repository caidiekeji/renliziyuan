import { NextRequest } from 'next/server';
import { ok, fail, getClientIp, handleError } from '@/lib/api/response';
import { loginSchema } from '@/lib/validators/zod';
import { verifyCode } from '@/lib/sms';
import { prisma } from '@/lib/db/prisma';
import { signAccessToken, signRefreshToken } from '@/lib/auth/jwt';
import { setSessionCookies } from '@/lib/auth/session';
import { globalRateLimit } from '@/lib/middleware/rate-limit';
import { getSiteConfig } from '@/lib/config';

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  if (!(await globalRateLimit(ip, '/api/auth/login', 'POST')))
    return fail('RATE_LIMITED', '请求过于频繁', 429);

  try {
    const parsed = loginSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return fail('VALIDATION_ERROR', parsed.error.issues[0]?.message || '参数错误');
    const { phone, code } = parsed.data;

    // 验证码校验（sms_enabled 关闭时跳过，开发阶段可免验证码登录）
    const cfg = await getSiteConfig();
    if (cfg.sms_enabled !== false) {
      const codeOk = await verifyCode(phone, code, 'LOGIN');
      if (!codeOk) {
        await prisma.loginLog.create({ data: { phone, success: false, ip, user_agent: req.headers.get('user-agent')?.slice(0, 300) } });
        return fail('INVALID_CODE', '验证码错误或已过期');
      }
    }

    const user = await prisma.user.findUnique({ where: { phone } });
    if (!user) return fail('USER_NOT_FOUND', '该手机号未注册，请先注册');
    if (user.status === 'BANNED') return fail('USER_BANNED', '账号已被封禁');
    if (user.status === 'DELETED') return fail('USER_DELETED', '账号已注销');

    await prisma.user.update({ where: { id: user.id }, data: { last_login_at: new Date() } });
    await prisma.loginLog.create({
      data: { phone, user_id: user.id, success: true, ip, user_agent: req.headers.get('user-agent')?.slice(0, 300) },
    });

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
