import { NextRequest } from 'next/server';
import { ok, fail, handleError } from '@/lib/api/response';
import { getUserFromRequest } from '@/lib/auth/session';
import { prisma } from '@/lib/db/prisma';
import { updateProfileSchema } from '@/lib/validators/zod';
import { clearSessionCookies } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

/** 当前用户资料 + 我的企业上下文 */
export async function GET() {
  const user = await getUserFromRequest();
  if (!user) return fail('UNAUTHORIZED', '未登录', 401);
  const companyMembers = await prisma.companyMember.findMany({
    where: { user_id: user.id, status: 'ACTIVE' },
    include: { company: { select: { id: true, name: true, logo: true, verify_status: true } } },
  });
  const companyIds = companyMembers.map((c) => c.company.id);
  // 聊天未读：收到的、未读的消息（排除自己发的）
  const chatUnread = await prisma.message.count({
    where: {
      read_at: null,
      sender_id: { not: user.id },
      conversation: {
        OR: [
          { candidate_id: user.id },
          companyIds.length > 0 ? { company_id: { in: companyIds } } : undefined,
        ].filter(Boolean) as any,
      },
    },
  });
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
    companies: companyMembers.map((c) => ({ ...c.company, role: c.role })),
    unread: chatUnread,
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

/** 注销账号（软删除 + 敏感字段脱敏 + 进回收池 + 全端登出） */
export async function DELETE() {
  const user = await getUserFromRequest();
  if (!user) return fail('UNAUTHORIZED', '未登录', 401);
  const phone = user.phone;
  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: {
        status: 'DELETED',
        deleted_at: new Date(),
        refresh_token_version: { increment: 1 },
        // 敏感字段脱敏（设计方案 §4.2）：姓名/手机号/邮箱/头像/简介/技能全部清空
        name: '已注销用户',
        phone: null,
        email: null,
        avatar: null,
        bio: null,
        skills: [],
      },
    }),
    // 手机号进回收池（90 天冷却期内禁止复用）；无手机号则跳过
    ...(phone ? [prisma.phoneReleasePool.create({ data: { phone, old_user_id: user.id } })] : []),
    prisma.seekerPost.updateMany({ where: { user_id: user.id, status: 'OPEN' }, data: { status: 'CLOSED', closed_reason: 'USER_DELETED' } }),
  ]);
  const res = ok({ success: true });
  clearSessionCookies(res);
  return res;
}
