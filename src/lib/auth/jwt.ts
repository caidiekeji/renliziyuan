import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/db/prisma';
import { getSiteConfig } from '@/lib/config';
import '@/lib/config/env-guard';

const ACCESS_SECRET = new TextEncoder().encode(
  process.env.JWT_ACCESS_SECRET || 'change-me-access-secret-please-32chars'
);
const REFRESH_SECRET = new TextEncoder().encode(
  process.env.JWT_REFRESH_SECRET || 'change-me-refresh-secret-please-32chars'
);

export const ACCESS_COOKIE = 'access_token';
export const REFRESH_COOKIE = 'refresh_token';

interface TokenPayload {
  uid: string;
  ver: number;
  jti?: string;
  role?: string;
}

async function cfg() {
  const c = await getSiteConfig();
  return { accessMin: c.token_ttl_min, refreshDays: c.refresh_ttl_days };
}

export async function signAccessToken(uid: string, ver: number, role?: string): Promise<string> {
  const { accessMin } = await cfg();
  return new SignJWT({ uid, ver, role })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${accessMin}m`)
    .sign(ACCESS_SECRET);
}

export async function signRefreshToken(uid: string, ver: number): Promise<string> {
  const { refreshDays } = await cfg();
  return new SignJWT({ uid, ver, jti: crypto.randomUUID() })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${refreshDays}d`)
    .sign(REFRESH_SECRET);
}

export async function verifyAccessToken(token: string): Promise<TokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, ACCESS_SECRET);
    return { uid: payload.uid as string, ver: payload.ver as number, role: payload.role as string };
  } catch {
    return null;
  }
}

/** 验证 refresh_token，并校验版本号与用户存在性 */
export async function verifyRefreshToken(token: string): Promise<{ uid: string; ver: number } | null> {
  try {
    const { payload } = await jwtVerify(token, REFRESH_SECRET);
    const uid = payload.uid as string;
    const ver = payload.ver as number;
    const user = await prisma.user.findUnique({ where: { id: uid } });
    if (!user || user.refresh_token_version !== ver) return null;
    if (user.status !== 'ACTIVE') return null;
    return { uid, ver };
  } catch {
    return null;
  }
}

/** 从请求 Cookie 读取用户（优先 access，过期尝试 refresh 续期） */
export async function getCurrentUser() {
  const store = await cookies();
  const access = store.get(ACCESS_COOKIE)?.value;
  if (access) {
    const payload = await verifyAccessToken(access);
    if (payload) {
      const u = await prisma.user.findUnique({ where: { id: payload.uid } });
      // 与 refresh 分支一致：仅 ACTIVE 用户通过，封禁/注销账号立即失效（不留 access 有效期窗口）
      if (u && u.status === 'ACTIVE') return u;
    }
  }
  const refresh = store.get(REFRESH_COOKIE)?.value;
  if (refresh) {
    const payload = await verifyRefreshToken(refresh);
    if (payload) {
      const user = await prisma.user.findUnique({ where: { id: payload.uid } });
      if (user && user.status === 'ACTIVE') return user;
    }
  }
  return null;
}
