import { ok, fail } from '@/lib/api/response';
import { prisma } from '@/lib/db/prisma';
import { getUserFromRequest, clearSessionCookies } from '@/lib/auth/session';
import { kickUser } from '@/lib/socket/server';

// 退出所有设备：refresh_token_version+1 使全部旧令牌失效，并实时踢下线
export async function POST() {
  const user = await getUserFromRequest();
  if (!user) return fail('UNAUTHORIZED', '未登录', 401);

  await prisma.user.update({ where: { id: user.id }, data: { refresh_token_version: { increment: 1 } } });
  kickUser(user.id, '已在其他设备退出登录');

  const res = ok({ success: true });
  clearSessionCookies(res);
  return res;
}