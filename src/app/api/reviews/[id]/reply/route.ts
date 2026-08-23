import { NextRequest } from 'next/server';
import { ok, fail, handleError } from '@/lib/api/response';
import { getUserFromRequest } from '@/lib/auth/session';
import { prisma } from '@/lib/db/prisma';
import { reviewReplySchema } from '@/lib/validators/zod';
import { sensitiveWordFilter } from '@/lib/sensitive/filter';
import { getSiteConfig } from '@/lib/config';

export const dynamic = 'force-dynamic';

/** 回复收到的评价（被评方回复） */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUserFromRequest();
  if (!user) return fail('UNAUTHORIZED', '未登录', 401);
  const { id } = await params;
  const parsed = reviewReplySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return fail('VALIDATION_ERROR', parsed.error.issues[0]?.message || '参数错误');

  const review = await prisma.review.findFirst({ where: { id, deleted_at: null } });
  if (!review) return fail('REVIEW_NOT_FOUND', '评价不存在', 404);

  // 权限：评价对象是本人或本人企业
  const isTargetCandidate = review.candidate_id === user.id;
  const isCompanyMember = review.company_id
    ? !!(await prisma.companyMember.findFirst({ where: { company_id: review.company_id, user_id: user.id, status: 'ACTIVE' } }))
    : false;
  if (!isTargetCandidate && !isCompanyMember) return fail('FORBIDDEN', '无权回复该评价', 403);

  const hit = await sensitiveWordFilter('REVIEW', parsed.data.reply);
  if (hit) return fail('SENSITIVE_WORD', `回复包含敏感词「${hit}」`);

  const cfg = await getSiteConfig();
  const replyStatus = cfg.reply_review_review ? 'PENDING' : 'APPROVED';
  try {
    const updated = await prisma.review.update({
      where: { id },
      data: { reply: parsed.data.reply, reply_by: user.id, reply_status: replyStatus },
    });
    return ok(updated);
  } catch (e) {
    return handleError(e);
  }
}
