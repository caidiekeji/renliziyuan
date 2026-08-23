import { prisma } from '@/lib/db/prisma';
import type { UserEventType } from '@prisma/client';
import { getRecommendationConfig } from '@/lib/config';

/** 事件权重兜底（配置不可用时的默认值，正常从 recommendation_config 读取） */
export const EVENT_WEIGHTS: Record<UserEventType, number> = { VIEW: 1, FAVORITE: 3, CHAT: 5 };

/** 记录浏览（去重：同 session 同 job 10 分钟内只记一次） */
export async function trackPageView(params: {
  userId?: string | null;
  sessionId: string;
  path: string;
  referer?: string | null;
  userAgent?: string | null;
  ip?: string | null;
  durationMs?: number | null;
}) {
  // 忽略爬虫
  const ua = params.userAgent || '';
  if (/bot|crawl|spider|slurp/i.test(ua)) return;
  const existing = await prisma.pageView.findFirst({
    where: { session_id: params.sessionId, path: params.path, created_at: { gte: new Date(Date.now() - 10 * 60_000) } },
    select: { id: true },
  });
  if (existing) return;
  await prisma.pageView.create({
    data: {
      user_id: params.userId || undefined,
      session_id: params.sessionId,
      path: params.path,
      referer: params.referer || undefined,
      user_agent: ua ? ua.slice(0, 300) : undefined,
      device: /mobile|android|iphone/i.test(ua) ? 'mobile' : 'desktop',
      duration_ms: params.durationMs || undefined,
    },
  });
}

/** 用户对职位的显式行为事件（推荐输入） */
export async function recordUserEvent(userId: string, jobId: string, eventType: UserEventType) {
  let weight: number;
  try {
    // 行为子权重从 recommendation_config 读取（非硬编码）
    const cfg = await getRecommendationConfig();
    weight =
      eventType === 'FAVORITE' ? Number(cfg.w_b_favorite) : eventType === 'VIEW' ? Number(cfg.w_b_view) : Number(cfg.w_b_chat);
  } catch {
    weight = EVENT_WEIGHTS[eventType];
  }
  await prisma.userEvent.create({ data: { user_id: userId, job_id: jobId, event_type: eventType, weight } });
}

/** 职位浏览量 +1 */
export async function incrementJobViews(jobId: string) {
  await prisma.job.update({ where: { id: jobId }, data: { views: { increment: 1 } } });
}

/** 每日统计归集（由 cron 在凌晨调用，汇总昨日） */
export async function rollupDailyStat(date = new Date()) {
  const day = new Date(date);
  day.setHours(0, 0, 0, 0);
  const next = new Date(day.getTime() + 24 * 3600 * 1000);

  const [pv, uv, newUsers, newCompanies, newJobs, newConversations, newReviews, paid] = await Promise.all([
    prisma.pageView.count({ where: { created_at: { gte: day, lt: next } } }),
    prisma.pageView.findMany({ where: { created_at: { gte: day, lt: next } }, distinct: ['session_id'], select: { session_id: true } }).then((r) => r.length),
    prisma.user.count({ where: { created_at: { gte: day, lt: next } } }),
    prisma.company.count({ where: { created_at: { gte: day, lt: next } } }),
    prisma.job.count({ where: { created_at: { gte: day, lt: next } } }),
    prisma.conversation.count({ where: { created_at: { gte: day, lt: next } } }),
    prisma.review.count({ where: { created_at: { gte: day, lt: next } } }),
    prisma.payment.aggregate({ where: { status: 'PAID', paid_at: { gte: day, lt: next } }, _sum: { amount: true } }),
  ]);

  // DAU/WAU/MAU：统计 UV 日活（简化：以 session 去重的登录用户数近似，此处以登录态 user_id 计数）
  const dau = await prisma.pageView.findMany({ where: { created_at: { gte: day, lt: next }, user_id: { not: null } }, distinct: ['user_id'], select: { user_id: true } }).then((r) => r.length);
  const wau = await prisma.pageView.findMany({ where: { created_at: { gte: new Date(day.getTime() - 6 * 24 * 3600 * 1000) }, user_id: { not: null } }, distinct: ['user_id'], select: { user_id: true } }).then((r) => r.length);
  const mau = await prisma.pageView.findMany({ where: { created_at: { gte: new Date(day.getTime() - 29 * 24 * 3600 * 1000) }, user_id: { not: null } }, distinct: ['user_id'], select: { user_id: true } }).then((r) => r.length);
  const activeCompanies = await prisma.company.count({ where: { updated_at: { gte: day } } });

  const existing = await prisma.dailyStat.findUnique({ where: { stat_date: day } });

  // 留存率：D 日新增用户在第 D+N 天仍有访问的比例（目标窗口尚未到来则为 null）
  const calcRetention = async (offsetDays: number): Promise<number | null> => {
    const targetStart = new Date(day.getTime() + offsetDays * 24 * 3600 * 1000);
    if (targetStart.getTime() >= Date.now()) return null;
    const targetEnd = new Date(targetStart.getTime() + 24 * 3600 * 1000);
    const newIds = await prisma.user.findMany({
      where: { created_at: { gte: day, lt: next } },
      select: { id: true },
    });
    if (newIds.length === 0) return null;
    const ids = newIds.map((u) => u.id);
    const active = await prisma.pageView.findMany({
      where: { user_id: { in: ids }, created_at: { gte: targetStart, lt: targetEnd } },
      distinct: ['user_id'],
      select: { user_id: true },
    }).then((r) => r.length);
    return active / ids.length;
  };
  const [retention_d1, retention_d7, retention_d30] = await Promise.all([calcRetention(1), calcRetention(7), calcRetention(30)]);

  const data = {
    pv,
    uv,
    dau,
    wau,
    mau,
    new_users: newUsers,
    new_companies: newCompanies,
    new_jobs: newJobs,
    new_conversations: newConversations,
    new_reviews: newReviews,
    paid_amount: paid._sum.amount ?? 0,
    active_companies: activeCompanies,
    retention_d1,
    retention_d7,
    retention_d30,
  };
  if (existing) await prisma.dailyStat.update({ where: { id: existing.id }, data });
  else await prisma.dailyStat.create({ data: { stat_date: day, ...data } });
  return data;
}
