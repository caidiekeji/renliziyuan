import { startRecalcRatingWorker } from './workers/recalc-rating';
import { startRecycleJobsWorker } from './workers/recycle-jobs';
import { startNotifyWorker } from './workers/notify';
import { rollupDailyStat } from '@/lib/analytics';
import { runDailyBoostCharges } from '@/lib/boost';
import { prisma } from '@/lib/db/prisma';
import { enqueue } from '@/lib/queue';
import { notifyUser } from '@/lib/notification';
import { log } from '@/lib/logger';

/** 每日 00:05 执行的统计归集（归集「昨日」完整一天的数据，避免跨日漂移） */
function scheduleDailyRollup() {
  const run = async () => {
    try {
      // 凌晨 00:05 归集昨日（昨天 00:00~24:00 已完整结束）
      const yesterday = new Date(Date.now() - 24 * 3600 * 1000);
      await rollupDailyStat(yesterday);
      log('info', 'worker:daily-rollup:done');
    } catch (e: any) {
      log('error', 'worker:daily-rollup:failed', { error: e?.message });
    }
    scheduleDailyRollup();
  };
  const now = new Date();
  const next = new Date(now);
  next.setHours(24, 5, 0, 0);
  const delay = Math.max(60_000, next.getTime() - now.getTime());
  setTimeout(run, delay);
}

/** 每日 00:00 竞价置顶扣费：按天从余额扣费，余额不足自动暂停并通知（v2.1/v2.2） */
function scheduleDailyBoostCharges() {
  const run = async () => {
    try {
      const count = await runDailyBoostCharges(new Date());
      log('info', 'worker:daily-boost-charge:done', { count });
    } catch (e: any) {
      log('error', 'worker:daily-boost-charge:failed', { error: e?.message });
    }
    scheduleDailyBoostCharges();
  };
  const now = new Date();
  const next = new Date(now);
  next.setHours(24, 0, 0, 0);
  const delay = Math.max(60_000, next.getTime() - now.getTime());
  setTimeout(run, delay);
}

/** 每日 00:10 订阅到期巡检：过期订阅置 EXPIRED + 通知企业 + 触发配额回收（免费版上限） */
function scheduleSubscriptionExpiry() {
  const run = async () => {
    try {
      const expired = await prisma.subscription.findMany({
        where: { status: 'ACTIVE', end_at: { lte: new Date() } },
        select: { id: true, company_id: true, plan_id: true },
      });
      for (const s of expired) {
        await prisma.subscription.update({ where: { id: s.id }, data: { status: 'EXPIRED' } }).catch(() => undefined);
        // 通知企业全员套餐到期
        const members = await prisma.companyMember
          .findMany({ where: { company_id: s.company_id, status: 'ACTIVE' }, select: { user_id: true } })
          .catch(() => []);
        for (const m of members) {
          await notifyUser({
            userId: m.user_id,
            type: 'PLAN_EXPIRE',
            title: '套餐已到期',
            body: '您的订阅套餐已到期，超配额职位将被关闭，请及时续费',
            link: '/company/billing',
          }).catch(() => undefined);
        }
        // 回收超配额职位（免费版 3 个上限）
        await enqueue.recycleJobs(s.company_id, s.plan_id).catch(() => undefined);
      }
      if (expired.length > 0) log('info', 'worker:subscription-expired', { count: expired.length });
    } catch (e: any) {
      log('error', 'worker:subscription-expiry:failed', { error: e?.message });
    }
    scheduleSubscriptionExpiry();
  };
  const now = new Date();
  const next = new Date(now);
  next.setHours(24, 10, 0, 0);
  const delay = Math.max(60_000, next.getTime() - now.getTime());
  setTimeout(run, delay);
}

/** 队列 Worker 进程：npm run worker */
export function startAllWorkers() {
  startRecalcRatingWorker();
  startRecycleJobsWorker();
  startNotifyWorker();
  scheduleDailyRollup();
  scheduleDailyBoostCharges();
  scheduleSubscriptionExpiry();
  log('info', 'worker:all-started');
}

if (require.main === module) {
  startAllWorkers();
}
