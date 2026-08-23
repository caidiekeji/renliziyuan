/**
 * 定时任务入口：npm run cron
 * - 每日统计归集（回填最近 N 天 + 当天）
 * - 用法：npm run cron  （回填默认过去 30 天）
 * 注：需 Redis 不在线时亦可运行（每日统计仅依赖 PostgreSQL）。
 */
import { rollupDailyStat } from '../../src/lib/analytics';
import { prisma } from '../../src/lib/db/prisma';
import { log } from '../../src/lib/logger';

const DAYS = Number(process.env.CRON_BACKFILL_DAYS || '30');

async function main() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let result;
  for (let i = DAYS; i >= 0; i--) {
    const day = new Date(today.getTime() - i * 24 * 3600 * 1000);
    result = await rollupDailyStat(day);
    log('info', `cron:daily-stat:done`, { date: day.toISOString().slice(0, 10), pv: result.pv, uv: result.uv });
  }
  log('info', 'cron:done', { backfillDays: DAYS });
}

main()
  .catch((e) => {
    log('error', 'cron:failed', { error: e?.message });
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());