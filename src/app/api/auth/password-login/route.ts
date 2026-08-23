import { NextRequest } from 'next/server';
import { ok, fail, getClientIp } from '@/lib/api/response';
import { passwordLoginSchema } from '@/lib/validators/zod';
import { prisma } from '@/lib/db/prisma';
import { signAccessToken, signRefreshToken } from '@/lib/auth/jwt';
import { setSessionCookies } from '@/lib/auth/session';
import { globalRateLimit } from '@/lib/middleware/rate-limit';
import bcrypt from 'bcryptjs';

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  if (!(await globalRateLimit(ip, '/api/auth/password-login', 'POST')))
    return fail('RATE_LIMITED', '请求过于频繁', 429);

  const parsed = passwordLoginSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return fail('VALIDATION_ERROR', parsed.error.issues[0]?.message || '参数错误');
  const { phone, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { phone } });
  if (!user || !user.password_hash) return fail('INVALID_CREDENTIALS', '手机号或密码错误');
  const match = await bcrypt.compare(password, user.password_hash);
  if (!match) {
    await prisma.loginLog.create({ data: { phone, success: false, ip, user_agent: req.headers.get('user-agent')?.slice(0, 300) } });
    return fail('INVALID_CREDENTIALS', '手机号或密码错误');
  }
  if (user.status === 'BANNED') return fail('USER_BANNED', '账号已被封禁');
  if (user.status === 'DELETED') return fail('USER_DELETED', '账号已注销');

  await prisma.user.update({ where: { id: user.id }, data: { last_login_at: new Date() } });
  await prisma.loginLog.create({ data: { phone, user_id: user.id, success: true, ip, user_agent: req.headers.get('user-agent')?.slice(0, 300) } });

  const res = ok({ user: { id: user.id, phone: user.phone, name: user.name, avatar: user.avatar, role: user.role } });
  const [access, refresh] = await Promise.all([
    signAccessToken(user.id, user.refresh_token_version, user.role),
    signRefreshToken(user.id, user.refresh_token_version),
  ]);
  setSessionCookies(res, access, refresh);
  return res;
}
