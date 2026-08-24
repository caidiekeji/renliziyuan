import { NextRequest } from 'next/server';
import { ok, fail } from '@/lib/api/response';
import { getUserFromRequest, requireCompanyMember } from '@/lib/auth/session';
import { prisma } from '@/lib/db/prisma';
import { getSiteConfig } from '@/lib/config';

export const dynamic = 'force-dynamic';

/** 恢复上线职位（配额校验 + 前置审核校验） */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUserFromRequest();
  if (!user) return fail('UNAUTHORIZED', '未登录', 401);
  const { id } = await params;
  const job = await prisma.job.findFirst({ where: { id, deleted_at: null } });
  if (!job) return fail('JOB_NOT_FOUND', '职位不存在', 404);
  const { error } = await requireCompanyMember(user, job.company_id, 'HR');
  if (error) return error;

  const cfg = await getSiteConfig();

  // 事务 + 企业行锁：串行化同企业下的恢复/发布配额读写，防止并发超卖（v1.9.3-P2③）
  const result = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Company" WHERE id = ${job.company_id}::uuid FOR UPDATE`;

    if (cfg.audit_mode === 'PRE') {
      await tx.job.update({ where: { id }, data: { status: 'CLOSED', closed_reason: null, audit_status: 'PENDING' } });
      return { status: 'PENDING_AUDIT' };
    }

    // 配额校验（行锁内重新计数，避免并发恢复都通过检查）
    const sub = await tx.subscription.findFirst({
      where: { company_id: job.company_id, status: 'ACTIVE', end_at: { gt: new Date() } },
      include: { plan: true },
    });
    const limit = sub ? sub.plan.job_limit : 3;
    if (limit !== 999999) {
      const openCount = await tx.job.count({ where: { company_id: job.company_id, status: 'OPEN', deleted_at: null } });
      if (openCount >= limit) return { status: 'JOB_LIMIT_EXCEEDED' as const };
    }
    await tx.job.update({ where: { id }, data: { status: 'OPEN', closed_reason: null } });
    return { status: 'OPEN' as const };
  });

  if (result.status === 'JOB_LIMIT_EXCEEDED') return fail('JOB_LIMIT_EXCEEDED', '职位数量已达套餐上限', 403);
  return ok({ status: result.status });
}
