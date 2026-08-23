import { NextRequest } from 'next/server';
import { ok, fail, handleError } from '@/lib/api/response';
import { getUserFromRequest, requireCompanyMember } from '@/lib/auth/session';
import { prisma } from '@/lib/db/prisma';
import { incrementJobViews } from '@/lib/analytics';
import { jobUpdateSchema } from '@/lib/validators/zod';
import { sensitiveWordFilter } from '@/lib/sensitive/filter';
import { getSiteConfig } from '@/lib/config';

export const dynamic = 'force-dynamic';

/** 职位详情（公开） */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const job = await prisma.job.findFirst({
    where: { id, status: 'OPEN', audit_status: 'APPROVED', deleted_at: null },
    include: {
      company: {
        select: { id: true, name: true, logo: true, size: true, location: true, verify_status: true, avg_rating: true, review_count: true },
      },
      industry: { select: { id: true, name: true } },
      job_title: { select: { id: true, name: true, category: true } },
    },
  });
  if (!job) return fail('JOB_NOT_FOUND', '职位不存在或已下线', 404);
  void incrementJobViews(job.id).catch(() => undefined);
  return ok(job);
}

/** 更新职位（企业成员） */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUserFromRequest();
  if (!user) return fail('UNAUTHORIZED', '未登录', 401);
  const { id } = await params;
  const job = await prisma.job.findFirst({ where: { id, deleted_at: null } });
  if (!job) return fail('JOB_NOT_FOUND', '职位不存在', 404);
  const { member, error } = await requireCompanyMember(user, job.company_id, 'HR');
  if (!member) return error!;

  const parsed = jobUpdateSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return fail('VALIDATION_ERROR', parsed.error.issues[0]?.message || '参数错误');
  if (parsed.data.title || parsed.data.description) {
    const hit = await sensitiveWordFilter('JOB', `${parsed.data.title || ''} ${parsed.data.description || ''}`);
    if (hit) return fail('SENSITIVE_WORD', `内容包含敏感词「${hit}」`);
  }
  const cfg = await getSiteConfig();
  // 置顶为套餐付费能力：更新时同样校验 can_feature，防止绕过发布/置顶接口的限制
  if (parsed.data.is_featured === true) {
    const sub = await prisma.subscription.findFirst({
      where: { company_id: job.company_id, status: 'ACTIVE', end_at: { gt: new Date() } },
      include: { plan: true },
    });
    if (!sub?.plan.can_feature) return fail('FEATURE_NOT_ALLOWED', '当前套餐不支持置顶', 403);
  }
  try {
    const updated = await prisma.job.update({
      where: { id },
      data: {
        ...parsed.data,
        // 内容变更后，前置审核模式下重新进入待审
        ...(parsed.data.title || parsed.data.description
          ? cfg.audit_mode === 'PRE'
            ? { audit_status: 'PENDING', status: 'CLOSED', closed_reason: 'AUDIT_REJECTED' as const }
            : {}
          : {}),
      },
    });
    return ok(updated);
  } catch (e) {
    return handleError(e);
  }
}

/** 删除职位（软删除，企业成员/管理员） */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUserFromRequest();
  if (!user) return fail('UNAUTHORIZED', '未登录', 401);
  const { id } = await params;
  const job = await prisma.job.findFirst({ where: { id } });
  if (!job) return fail('JOB_NOT_FOUND', '职位不存在', 404);
  if (user.role !== 'ADMIN') {
    const { error } = await requireCompanyMember(user, job.company_id, 'HR');
    if (error) return error;
  }
  await prisma.job.update({ where: { id }, data: { deleted_at: new Date(), status: 'CLOSED', closed_reason: 'COMPANY' } });
  return ok({ success: true });
}
