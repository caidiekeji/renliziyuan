import { ok } from '@/lib/api/response';
import { requireAdmin } from '@/lib/auth/admin';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';

/** 小时工平台数据概览：总职位/总报名/总取消 */
export async function GET() {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;

  const [totalJobs, totalApplied, totalCancelled] = await Promise.all([
    prisma.job.count({ where: { is_hourly: true } }),
    prisma.hourlyJobApplication.count({ where: { status: 'APPLIED' } }),
    prisma.hourlyJobApplication.count({ where: { status: 'CANCELLED' } }),
  ]);
  return ok({ total_jobs: totalJobs, total_applied: totalApplied, total_cancelled: totalCancelled });
}
