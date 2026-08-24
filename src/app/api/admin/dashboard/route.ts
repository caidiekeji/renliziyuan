import { ok } from '@/lib/api/response';
import { requireAdmin } from '@/lib/auth/admin';
import { prisma } from '@/lib/db/prisma';
import { ensureRedis } from '@/lib/db/redis';

export const dynamic = 'force-dynamic';

/** 管理后台总览统计 */
export async function GET() {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekAgo = new Date(today.getTime() - 6 * 24 * 3600 * 1000);

  const [totalUsers, newUsersToday, activeCompanies, totalJobs, openJobs, pendingJobs, totalConversations, totalPayments, revenue, pendingReviews, pendingReports] =
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
    ]);

  // 在线用户：优先读 Redis 心跳 ZSET（最近 10 分钟活跃登录用户），Redis 不可用时回退 PageView 统计
  let onlineCount = 0;
  try {
    const r = await ensureRedis();
    const min = Date.now() / 1000 - 600;
    onlineCount = await r.zcount('online:users', min, '+inf');
  } catch {
    const rows = await prisma.$queryRaw<{ cnt: number }[]>`SELECT count(DISTINCT user_id)::int AS cnt FROM "PageView" WHERE user_id IS NOT NULL AND created_at >= now() - interval '10 minutes'`;
    onlineCount = Number(rows[0]?.cnt ?? 0);
  }

  // 近 7 日趋势：实时按天统计（北京时区），不依赖每日归集的 dailyStat
  const days: Date[] = [];
  for (let i = 0; i < 7; i++) days.push(new Date(today.getTime() + i * 24 * 3600 * 1000));
  const dayKey = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
  };
  const [userRows, companyRows, jobRows, convRows, reviewRows, payRows, pvRows] = await Promise.all([
    prisma.$queryRaw<{ d: string; v: number }[]>`SELECT to_char(created_at AT TIME ZONE 'Asia/Shanghai', 'YYYY-MM-DD') AS d, count(*)::int AS v FROM "User" WHERE status <> 'DELETED' AND created_at >= ${weekAgo} GROUP BY d`,
    prisma.$queryRaw<{ d: string; v: number }[]>`SELECT to_char(created_at AT TIME ZONE 'Asia/Shanghai', 'YYYY-MM-DD') AS d, count(*)::int AS v FROM "Company" WHERE created_at >= ${weekAgo} GROUP BY d`,
    prisma.$queryRaw<{ d: string; v: number }[]>`SELECT to_char(created_at AT TIME ZONE 'Asia/Shanghai', 'YYYY-MM-DD') AS d, count(*)::int AS v FROM "Job" WHERE deleted_at IS NULL AND created_at >= ${weekAgo} GROUP BY d`,
    prisma.$queryRaw<{ d: string; v: number }[]>`SELECT to_char(created_at AT TIME ZONE 'Asia/Shanghai', 'YYYY-MM-DD') AS d, count(*)::int AS v FROM "Conversation" WHERE created_at >= ${weekAgo} GROUP BY d`,
    prisma.$queryRaw<{ d: string; v: number }[]>`SELECT to_char(created_at AT TIME ZONE 'Asia/Shanghai', 'YYYY-MM-DD') AS d, count(*)::int AS v FROM "Review" WHERE deleted_at IS NULL AND created_at >= ${weekAgo} GROUP BY d`,
    prisma.$queryRaw<{ d: string; v: number }[]>`SELECT to_char(paid_at AT TIME ZONE 'Asia/Shanghai', 'YYYY-MM-DD') AS d, COALESCE(sum(amount), 0)::numeric AS v FROM "Payment" WHERE status = 'PAID' AND paid_at IS NOT NULL AND paid_at >= ${weekAgo} GROUP BY d`,
    prisma.$queryRaw<{ d: string; pv: number; uv: number; dau: number }[]>`SELECT to_char(created_at AT TIME ZONE 'Asia/Shanghai', 'YYYY-MM-DD') AS d, count(*)::int AS pv, count(DISTINCT session_id)::int AS uv, count(DISTINCT user_id) FILTER (WHERE user_id IS NOT NULL)::int AS dau FROM "PageView" WHERE created_at >= ${weekAgo} GROUP BY d`,
  ]);
  const idx = <T extends { d: string }>(rows: T[]) => new Map(rows.map((r) => [r.d, r]));
  const uMap = idx(userRows);
  const cMap = idx(companyRows);
  const jMap = idx(jobRows);
  const convMap = idx(convRows);
  const rvMap = idx(reviewRows);
  const payMap = idx(payRows);
  const pvMap = idx(pvRows);
  const trend = days.map((day) => {
    const k = dayKey(day);
    const pvRow = pvMap.get(k) as { pv: number; uv: number; dau: number } | undefined;
    return {
      stat_date: day,
      pv: pvRow?.pv ?? 0,
      uv: pvRow?.uv ?? 0,
      dau: pvRow?.dau ?? 0,
      wau: 0,
      mau: 0,
      new_users: uMap.get(k)?.v ?? 0,
      new_companies: cMap.get(k)?.v ?? 0,
      new_jobs: jMap.get(k)?.v ?? 0,
      new_conversations: convMap.get(k)?.v ?? 0,
      new_reviews: rvMap.get(k)?.v ?? 0,
      paid_amount: payMap.get(k)?.v ?? 0,
      active_companies: 0,
    };
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
