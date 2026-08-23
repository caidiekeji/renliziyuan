import { NextRequest } from 'next/server';
import { fail, created, handleError } from '@/lib/api/response';
import { getUserFromRequest } from '@/lib/auth/session';
import { prisma } from '@/lib/db/prisma';
import { reviewCreateSchema } from '@/lib/validators/zod';
import { sensitiveWordFilter } from '@/lib/sensitive/filter';
import { enqueue } from '@/lib/queue';
import { getSiteConfig } from '@/lib/config';
import { notifyUser } from '@/lib/notification';
import { withLock } from '@/lib/db/redis';
import { log } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/** 创建评价（双向：普通职位会话评价 / 小时工报名评价，v2.6 强化） */
export async function POST(req: NextRequest) {
  const user = await getUserFromRequest();
  if (!user) return fail('UNAUTHORIZED', '未登录', 401);
  const parsed = reviewCreateSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return fail('VALIDATION_ERROR', parsed.error.issues[0]?.message || '参数错误');
  const { target_type, conversation_id, scope, hourly_application_id, rating, content } = parsed.data;

  const cfg = await getSiteConfig();

  // 评分上限：由 site_config.rating_max 控制（后台可调），禁止超出
  if (rating > cfg.rating_max) return fail('INVALID_RATING', `评分不能超过 ${cfg.rating_max} 星`, 400);

  // ============ 小时工评价（scope=HOURLY）============
  if (scope === 'HOURLY') {
    const app = await prisma.hourlyJobApplication.findUnique({
      where: { id: hourly_application_id! },
      include: { job: { select: { company_id: true } } },
    });
    if (!app) return fail('APPLICATION_NOT_FOUND', '报名记录不存在', 404);
    if (app.status === 'CANCELLED') return fail('APPLICATION_CANCELLED', '已取消的报名不可评价', 400);

    // 报名满 hourly_review_min_hours 方可评价（默认 24h，0=不限制）
    if (cfg.hourly_review_min_hours > 0) {
      const minElapsed = (Date.now() - app.created_at.getTime()) / 3600_000;
      if (minElapsed < cfg.hourly_review_min_hours)
        return fail('TOO_EARLY', `报名满 ${cfg.hourly_review_min_hours} 小时后方可评价`, 400);
    }

    const isCandidate = app.user_id === user.id;
    const member = await prisma.companyMember.findFirst({
      where: { company_id: app.job.company_id, user_id: user.id, status: 'ACTIVE' },
    });
    if (!isCandidate && !member) return fail('FORBIDDEN', '非报名者或该企业成员', 403);
    if (target_type === 'COMPANY' && !isCandidate) return fail('INVALID_TARGET', '仅报名者可评价企业', 403);
    if (target_type === 'CANDIDATE' && !member) return fail('INVALID_TARGET', '仅企业成员可评价求职者', 403);

    const hit = await sensitiveWordFilter('REVIEW', content);
    if (hit) return fail('SENSITIVE_WORD', `内容包含敏感词「${hit}」`);

    try {
      const review = await withLock(`lock:review:${user.id}:HOURLY:${app.id}`, 3000, async () => {
        const existing = await prisma.review.findFirst({
          where: { reviewer_id: user.id, scope: 'HOURLY', hourly_application_id: app.id, deleted_at: null },
        });
        if (existing) throw new ReviewConflict('您已评价过该报名');
        const autoApprove = !cfg.reply_review_review;
        const created = await prisma.review.create({
          data: {
            reviewer_id: user.id,
            reviewee_type: target_type,
            company_id: target_type === 'COMPANY' ? app.job.company_id : null,
            candidate_id: target_type === 'CANDIDATE' ? app.user_id : null,
            scope: 'HOURLY',
            hourly_application_id: app.id,
            rating,
            content,
            reply_status: autoApprove ? 'APPROVED' : 'PENDING',
          },
        });
        if (target_type === 'COMPANY') await enqueue.recalcRating(app.job.company_id);
        if (target_type === 'COMPANY') {
          const members = await prisma.companyMember.findMany({
            where: { company_id: app.job.company_id, status: 'ACTIVE' },
            select: { user_id: true },
          });
          for (const m of members)
            await notifyUser({ userId: m.user_id, type: 'NEW_REVIEW', title: '收到新评价', body: content.slice(0, 50), link: `/companies/${app.job.company_id}` });
        } else {
          await notifyUser({ userId: app.user_id, type: 'NEW_REVIEW', title: '收到新评价', body: content.slice(0, 50), link: `/candidates/${app.user_id}` });
        }
        return created;
      });
      if (!review) return fail('ALREADY_REVIEWED', '您已评价过该报名', 409);
      return created(review);
    } catch (e) {
      if (e instanceof ReviewConflict) return fail('ALREADY_REVIEWED', e.message, 409);
      log('error', 'review:hourly-create-failed', { error: (e as Error)?.message });
      return handleError(e);
    }
  }

  // ============ 普通职位评价（scope=JOB）============
  const conv = await prisma.conversation.findFirst({
    where: { id: conversation_id },
    include: { company: { include: { members: { where: { status: 'ACTIVE' }, select: { user_id: true } } } } },
  });
  if (!conv) return fail('CONVERSATION_NOT_FOUND', '会话不存在', 404);

  const isCandidate = conv.candidate_id === user.id;
  const isCompanyMember = conv.company.members.some((m) => m.user_id === user.id);
  if (!isCandidate && !isCompanyMember) return fail('FORBIDDEN', '非会话参与方', 403);

  const msgCount = await prisma.message.count({ where: { conversation_id: conv.id } });
  if (msgCount === 0) return fail('NO_MESSAGES', '会话尚无可评价内容');

  if (target_type === 'COMPANY' && !isCandidate) return fail('INVALID_TARGET', '仅求职者可评价企业');
  if (target_type === 'CANDIDATE' && !isCompanyMember) return fail('INVALID_TARGET', '仅企业可评价求职者');

  const hit = await sensitiveWordFilter('REVIEW', content);
  if (hit) return fail('SENSITIVE_WORD', `内容包含敏感词「${hit}」`);

  try {
    const review = await withLock(`lock:review:${user.id}:JOB:${conv.id}`, 3000, async () => {
      const existing = await prisma.review.findFirst({
        where: { reviewer_id: user.id, scope: 'JOB', conversation_id: conv.id, deleted_at: null },
      });
      if (existing) throw new ReviewConflict('该会话您已评价过');
      const autoApprove = !cfg.reply_review_review;
      const created = await prisma.review.create({
        data: {
          reviewer_id: user.id,
          reviewee_type: target_type,
          company_id: target_type === 'COMPANY' ? conv.company_id : null,
          candidate_id: target_type === 'CANDIDATE' ? conv.candidate_id : null,
          conversation_id: conv.id,
          rating,
          content,
          reply_status: autoApprove ? 'APPROVED' : 'PENDING',
        },
      });
      if (target_type === 'COMPANY') await enqueue.recalcRating(conv.company_id);
      const notifyUserId = target_type === 'COMPANY' ? conv.company.members[0]?.user_id : conv.candidate_id;
      if (notifyUserId) {
        await notifyUser({ userId: notifyUserId, type: 'NEW_REVIEW', title: '收到新评价', body: content.slice(0, 50), link: '/reviews' });
      }
      return created;
    });
    if (!review) return fail('ALREADY_REVIEWED', '该会话您已评价过', 409);
    return created(review);
  } catch (e) {
    if (e instanceof ReviewConflict) return fail('ALREADY_REVIEWED', e.message, 409);
    log('error', 'review:create-failed', { error: (e as Error)?.message });
    return handleError(e);
  }
}

class ReviewConflict extends Error {}
