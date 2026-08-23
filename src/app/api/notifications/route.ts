import { NextRequest } from 'next/server';
import { ok, fail } from '@/lib/api/response';
import { getUserFromRequest } from '@/lib/auth/session';
import { prisma } from '@/lib/db/prisma';
import { clearUnread } from '@/lib/notification';

export const dynamic = 'force-dynamic';

/** 我的通知列表（站内信） */
export async function GET(req: NextRequest) {
  const user = await getUserFromRequest();
  if (!user) return fail('UNAUTHORIZED', '未登录', 401);
  const page = Math.max(1, Number(req.nextUrl.searchParams.get('page')) || 1);
  const pageSize = Math.min(50, Math.max(1, Number(req.nextUrl.searchParams.get('pageSize')) || 20));
  const unreadOnly = req.nextUrl.searchParams.get('unread') === '1';

  const where: any = { user_id: user.id, ...(unreadOnly ? { read_at: null } : {}) };
  const [total, items] = await Promise.all([
    prisma.notification.count({ where }),
    prisma.notification.findMany({ where, orderBy: { created_at: 'desc' }, skip: (page - 1) * pageSize, take: pageSize }),
  ]);
  const unread = await prisma.notification.count({ where: { user_id: user.id, read_at: null } });
  return ok(items, { total, page, pageSize, unread });
}

/** 全部已读 */
export async function PUT() {
  const user = await getUserFromRequest();
  if (!user) return fail('UNAUTHORIZED', '未登录', 401);
  await prisma.notification.updateMany({ where: { user_id: user.id, read_at: null }, data: { read_at: new Date() } });
  await clearUnread(user.id);
  return ok({ success: true });
}
