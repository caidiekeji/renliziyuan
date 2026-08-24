import { NextRequest } from 'next/server';
import { ok, fail } from '@/lib/api/response';
import { getUserFromRequest } from '@/lib/auth/session';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';

/** 单会话详情（含对方信息），仅参与方可见；供聊天页头部展示，避免拉取全量列表 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUserFromRequest();
  if (!user) return fail('UNAUTHORIZED', '未登录', 401);
  const { id } = await params;

  const conv = await prisma.conversation.findUnique({
    where: { id },
    include: {
      job: { select: { id: true, title: true } },
      candidate: { select: { id: true, name: true, avatar: true } },
      company: { select: { id: true, name: true, logo: true } },
      seeker_post: { select: { id: true, title: true } },
    },
  });
  if (!conv) return fail('CONVERSATION_NOT_FOUND', '会话不存在', 404);

  // 权限：求职者本人 或 所属企业成员
  const isCandidate = conv.candidate_id === user.id;
  const member = isCandidate
    ? null
    : await prisma.companyMember.findFirst({ where: { company_id: conv.company_id, user_id: user.id, status: 'ACTIVE' } });
  if (!isCandidate && !member) return fail('FORBIDDEN', '无权访问该会话', 403);

  return ok(conv);
}
