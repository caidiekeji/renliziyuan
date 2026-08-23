import { NextRequest } from 'next/server';
import { ok } from '@/lib/api/response';
import { prisma } from '@/lib/db/prisma';
import { clearSessionCookies, getUserFromRequest } from '@/lib/auth/session';
import { kickUser } from '@/lib/socket/server';

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest();
  const device = (await req.json().catch(() => ({}))).device;

  if (user) {
    if (device === 'all') {
      // 全端注销：使所有 refresh_token 失效，并实时踢下线所有设备
      await prisma.user.update({ where: { id: user.id }, data: { refresh_token_version: { increment: 1 } } });
      kickUser(user.id, '已在其他设备退出登录');
    }
  }
  const res = ok({ success: true });
  clearSessionCookies(res);
  return res;
}
