import { cookies } from 'next/headers';
import type { User } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  getCurrentUser,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from './jwt';

export type AuthUser = User;

export async function getUserFromRequest(): Promise<AuthUser | null> {
  return getCurrentUser();
}

export function errorResponse(code: string, message: string, status = 400): NextResponse {
  return NextResponse.json({ error: code, message }, { status });
}

/** 设置 access/refresh Cookie */
export function setSessionCookies(res: NextResponse, access: string, refresh: string) {
  const base = { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const, path: '/' };
  res.cookies.set(ACCESS_COOKIE, access, { ...base, maxAge: 30 * 60 });
  res.cookies.set(REFRESH_COOKIE, refresh, { ...base, maxAge: 30 * 24 * 3600 });
}

export function clearSessionCookies(res: NextResponse) {
  res.cookies.set(ACCESS_COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 });
  res.cookies.set(REFRESH_COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 });
}

/** 静默续期：请求进来时校验 access；过期则用 refresh 换新 */
export async function refreshSessionIfNeeded(): Promise<{ user: AuthUser | null; res?: NextResponse }> {
  const store = await cookies();
  const access = store.get(ACCESS_COOKIE)?.value;
  const refresh = store.get(REFRESH_COOKIE)?.value;
  const { verifyAccessToken } = await import('./jwt');
  if (access) {
    const payload = await verifyAccessToken(access);
    if (payload) {
      const { prisma } = await import('@/lib/db/prisma');
      const user = await prisma.user.findUnique({ where: { id: payload.uid } });
      return { user: user && user.status === 'ACTIVE' ? user : null };
    }
  }
  if (refresh) {
    const payload = await verifyRefreshToken(refresh);
    if (payload) {
      const { prisma } = await import('@/lib/db/prisma');
      const user = await prisma.user.findUnique({ where: { id: payload.uid } });
      if (user && user.status === 'ACTIVE') {
        const res = new NextResponse();
        const [a, r] = await Promise.all([signAccessToken(user.id, user.refresh_token_version, user.role), signRefreshToken(user.id, user.refresh_token_version)]);
        setSessionCookies(res, a, r);
        return { user, res };
      }
    }
  }
  return { user: null };
}

/** 校验当前用户是否为企业有效成员 */
export async function requireCompanyMember(user: AuthUser, companyId: string, minRole?: 'OWNER' | 'HR' | 'VIEWER') {
  const { prisma } = await import('@/lib/db/prisma');
  const member = await prisma.companyMember.findFirst({
    where: { company_id: companyId, user_id: user.id, status: 'ACTIVE' },
  });
  if (!member) return { member: null, error: errorResponse('INVALID_CONTEXT', '非该企业有效成员', 403) };
  if (minRole === 'OWNER' && member.role !== 'OWNER')
    return { member, error: errorResponse('FORBIDDEN', '需要企业所有者权限', 403) };
  if (minRole === 'HR' && member.role === 'VIEWER')
    return { member, error: errorResponse('FORBIDDEN', 'VIEWER 无此权限', 403) };
  return { member, error: null };
}

/** 解析企业上下文：X-Company-ID 请求头或 ?company_id= 参数 */
export function getCompanyContext(req: NextRequest): string | null {
  const fromHeader = req.headers.get('x-company-id');
  if (fromHeader) return fromHeader;
  const url = new URL(req.url);
  return url.searchParams.get('company_id');
}
