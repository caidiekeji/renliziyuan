import { createWorker } from '../index';
import { prisma } from '@/lib/db/prisma';
import { log } from '@/lib/logger';

/** 免费版在招职位上限（与发布接口 POST /api/jobs 的免费限额保持一致） */
export const FREE_JOB_LIMIT = 3;

/** 套餐到期/变更后的职位配额回收（按发布日期降序关闭超配额职位） */
export function startRecycleJobsWorker() {
  return createWorker('recycle-jobs', async ({ companyId }: { companyId: string; planId?: string }) => {
    // 当前有效订阅（未到期）；无有效订阅 → 免费版配额
    const sub = await prisma.subscription.findFirst({
      where: { company_id: companyId, status: 'ACTIVE', end_at: { gt: new Date() } },
      include: { plan: true },
      orderBy: { end_at: 'desc' },
    });
    const limit = sub ? (sub.plan.job_limit ?? 0) : FREE_JOB_LIMIT;

    const openJobs = await prisma.job.findMany({
      where: { company_id: companyId, status: 'OPEN', deleted_at: null },
      orderBy: { created_at: 'desc' },
      select: { id: true },
    });

    const surplus = openJobs.slice(limit);
    if (surplus.length > 0) {
      await prisma.job.updateMany({
        where: { id: { in: surplus.map((j) => j.id) } },
        data: { status: 'CLOSED', closed_reason: 'QUOTA_EXCEEDED' },
      });
      log('info', 'recycle-jobs:closed', { companyId, closed: surplus.length, limit });
    }
  });
}
