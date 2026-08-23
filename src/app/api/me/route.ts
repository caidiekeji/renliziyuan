import { NextRequest } from 'next/server';
import { ok, fail, handleError } from '@/lib/api/response';
import { getUserFromRequest } from '@/lib/auth/session';
import { prisma } from '@/lib/db/prisma';
import { updateProfileSchema } from '@/lib/validators/zod';
import { clearSessionCookies } from '@/lib/auth/session';
import { getUnreadCount } from '@/lib/notification';

export const dynamic = 'force-dynamic';

/** 当前用户资料 + 我的企业上下文 */
export async function GET() {
  const user = await getUserFromRequest();
  if (!user) return fail('UNAUTHORIZED', '未登录', 401);
  const [companies, unread] = await Promise.all([
    prisma.companyMember.findMany({
      where: { user_id: user.id, status: 'ACTIVE' },
      include: { company: { select: { id: true, name: true, logo: true, verify_status: true } } },
    }),
    getUnreadCount(user.id),
  ]);
  return ok({
    id: user.id,
    phone: user.phone,
    name: user.name,
    avatar: user.avatar,
    bio: user.bio,
    role: user.role,
    title: user.title,
    city: user.city,
    skills: user.skills,
    status: user.status,
    created_at: user.created_at,
    companies: companies.map((c) => ({ ...c.company, role: c.role })),
    unread,
  });
}

/** 更新资料 */
export async function PUT(req: NextRequest) {
  const user = await getUserFromRequest();
  if (!user) return fail('UNAUTHORIZED', '未登录', 401);
  const parsed = updateProfileSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return fail('VALIDATION_ERROR', parsed.error.issues[0]?.message || '参数错误');
  try {
    const updated = await prisma.user.update({ where: { id: user.id }, data: parsed.data });
    return ok({ name: updated.name, avatar: updated.avatar, bio: updated.bio, title: updated.title, city: updated.city, skills: updated.skills });
  } catch (e) {
    return handleError(e);
  }
}

/** 注销账号（软删除 + 进回收池 + 全端登出） */
export async function DELETE() {
  const user = await getUserFromRequest();
  if (!user) return fail('UNAUTHORIZED', '未登录', 401);
  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { status: 'DELETED', deleted_at: new Date(), refresh_token_version: { increment: 1 } },
    }),
    prisma.phoneReleasePool.create({ data: { phone: user.phone!, old_user_id: user.id } }),
    prisma.seekerPost.updateMany({ where: { user_id: user.id, status: 'OPEN' }, data: { status: 'CLOSED', closed_reason: 'USER_DELETED' } }),
  ]);
  const res = ok({ success: true });
  clearSessionCookies(res);
  return res;
}
