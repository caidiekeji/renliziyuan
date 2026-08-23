import { NextRequest } from 'next/server';
import { ok, fail } from '@/lib/api/response';
import { verifyRefreshToken, REFRESH_COOKIE, signAccessToken, signRefreshToken } from '@/lib/auth/jwt';
import { setSessionCookies } from '@/lib/auth/session';
import { prisma } from '@/lib/db/prisma';
import { globalRateLimit } from '@/lib/middleware/rate-limit';
import { getClientIp } from '@/lib/api/response';

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  if (!(await globalRateLimit(ip, '/api/auth/refresh', 'POST')))
    return fail('RATE_LIMITED', '请求过于频繁', 429);

  const refreshToken = req.cookies.get(REFRESH_COOKIE)?.value;
  if (!refreshToken) return fail('UNAUTHORIZED', '未登录', 401);

  const payload = await verifyRefreshToken(refreshToken);
  if (!payload) return fail('UNAUTHORIZED', '登录已过期，请重新登录', 401);

  const user = await prisma.user.findUnique({ where: { id: payload.uid } });
  if (!user || user.status !== 'ACTIVE') return fail('UNAUTHORIZED', '账号状态异常', 401);

  const res = ok({ user: { id: user.id, phone: user.phone, name: user.name, avatar: user.avatar, role: user.role } });
  const [access, refresh] = await Promise.all([
    signAccessToken(user.id, user.refresh_token_version, user.role),
    signRefreshToken(user.id, user.refresh_token_version),
  ]);
  setSessionCookies(res, access, refresh);
  return res;
}
