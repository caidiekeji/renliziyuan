import { ok } from '@/lib/api/response';
import { requireAdmin } from '@/lib/auth/admin';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';

/** 管理后台总览统计 */
export async function GET() {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekAgo = new Date(today.getTime() - 6 * 24 * 3600 * 1000);

  const [totalUsers, newUsersToday, activeCompanies, totalJobs, openJobs, pendingJobs, totalConversations, totalPayments, revenue, pendingReviews, pendingReports, onlineCount] =
    await Promise.all([
      prisma.user.count({ where: { status: { not: 'DELETED' } } }),
      prisma.user.count({ where: { status: { not: 'DELETED' }, created_at: { gte: today } } }),
      prisma.company.count({}),
      prisma.job.count({ where: { deleted_at: null } }),
      prisma.job.count({ where: { status: 'OPEN', deleted_at: null } }),
      prisma.job.count({ where: { audit_status: 'PENDING', deleted_at: null } }),
      prisma.conversation.count({}),
      prisma.payment.count({ where: { status: 'PAID' } }),
      prisma.payment.aggregate({ where: { status: 'PAID' }, _sum: { amount: true } }),
      prisma.review.count({ where: { reply_status: 'PENDING', deleted_at: null } }),
      prisma.report.count({ where: { status: 'PENDING' } }),
      0,
    ]);

  // 近 7 日趋势
  const trend = await prisma.dailyStat.findMany({
    where: { stat_date: { gte: weekAgo } },
    orderBy: { stat_date: 'asc' },
  });

  return ok({
    totalUsers,
    newUsersToday,
    activeCompanies,
    totalJobs,
    openJobs,
    pendingJobs,
    totalConversations,
    totalPayments,
    revenue: Number(revenue._sum.amount || 0),
    pendingReviews,
    pendingReports,
    onlineCount,
    trend,
  });
}
