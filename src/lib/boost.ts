import { prisma } from '@/lib/db/prisma';
import { notifyUser } from '@/lib/notification';
import { ensureRedis } from '@/lib/db/redis';
import { log } from '@/lib/logger';

const DAY = 86_400_000;
const BOOST_CACHE_TTL = 300; // 置顶职位结果缓存秒数（5 分钟）
const round2 = (n: number) => Math.round(n * 100) / 100;
const dayStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/**
 * 查询某城市置顶职位（Top3 出价）：全局按 bid 降序取前 3，不区分类型；
 * job_type 仅用于筛选（搜索某类型时匹配 job_type=? OR job_type IS NULL）。
 * 结果缓存 Redis key=boost:{city}:{jobType|ALL}，TTL 5 分钟（v2.2 P2-1 修复）。
 */
export async function getCityBoostJobs(city?: string, jobType?: string): Promise<any[]> {
  const cacheKey = `boost:${city || 'ALL'}:${jobType || 'ALL'}`;
  try {
    const r = await ensureRedis();
    const cached = await r.get(cacheKey);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch {
        /* 缓存损坏则回源 */
      }
    }
  } catch {
    /* Redis 不可用时回源 */
  }

  const where: any = {
    status: 'ACTIVE',
    end_date: { gte: dayStart(new Date()) }, // 未到期：cron 未跑时也不展示已过期置顶
    job: { deleted_at: null }, // 职位未删除
  };
  if (city) where.city = city;
  if (jobType) where.OR = [{ job_type: jobType }, { job_type: null }];

  const boosts = await prisma.jobBiddingBoost.findMany({
    where,
    orderBy: [{ bid: 'desc' }, { start_date: 'asc' }],
    take: 3,
    include: {
      job: {
        include: {
          company: { select: { id: true, name: true, logo: true, verify_status: true, avg_rating: true } },
          industry: { select: { id: true, name: true } },
          job_title: { select: { id: true, name: true, category: true } },
        },
      },
    },
  });

  // 仅保留仍有效期内且未删除的职位
  const now = new Date();
  const items = boosts
    .filter((b) => now.getTime() >= dayStart(b.start_date).getTime())
    .map((b) => ({ ...b.job, bid: b.bid }));
  try {
    const r = await ensureRedis();
    await r.set(cacheKey, JSON.stringify(items), 'EX', BOOST_CACHE_TTL);
  } catch {
    /* ignore */
  }
  return items;
}

/** 冻结置顶预计费用：balance 不变，frozen += amount（FREEZE 记账，余额不足抛错） */
export async function freezeBoostFunds(companyId: string, amount: number, description: string) {
  const result = await prisma.$transaction(async (tx) => {
    const rows = (await tx.$queryRaw`SELECT * FROM "CompanyWallet" WHERE company_id = ${companyId}::uuid FOR UPDATE`) as any[];
    let wallet = rows[0];
    if (!wallet) wallet = await tx.companyWallet.create({ data: { company_id: companyId } });
    const balance = Number(wallet.balance);
    const frozen = Number(wallet.frozen);
    // 可用余额 = balance - frozen，防止多次冻结累计超过实际余额（透支）
    if (balance - frozen < amount - 0.001) throw new Error('INSUFFICIENT_BALANCE');
    await tx.companyWallet.update({
      where: { company_id: companyId },
      data: { frozen: round2(frozen + amount) },
    });
    await tx.walletTransaction.create({
      data: { company_id: companyId, type: 'FREEZE', amount: round2(amount), balance_after: round2(balance), description },
    });
    return round2(balance);
  });
  return result;
}

/** 释放置顶剩余冻结：frozen -= amount（UNFREEZE 记账），amount<=0 时跳过 */
export async function releaseBoostFunds(companyId: string, amount: number, description: string) {
  if (amount <= 0.001) return;
  await prisma.$transaction(async (tx) => {
    const rows = (await tx.$queryRaw`SELECT * FROM "CompanyWallet" WHERE company_id = ${companyId}::uuid FOR UPDATE`) as any[];
    const wallet = rows[0] ?? (await tx.companyWallet.create({ data: { company_id: companyId } }));
    const frozen = Math.max(0, Number(wallet.frozen) - amount);
    await tx.companyWallet.update({
      where: { company_id: companyId },
      data: { frozen: round2(frozen) },
    });
    await tx.walletTransaction.create({
      data: { company_id: companyId, type: 'UNFREEZE', amount: round2(amount), balance_after: round2(Number(wallet.balance)), description },
    });
  });
}

/** 置顶剩余未扣天数对应的冻结额（供释放计算） */
export function remainingFrozen(boost: { bid: number | { toNumber(): number }; end_date: Date }, today: Date): number {
  const bid = Number(boost.bid);
  const remainingDays = Math.max(0, Math.ceil((boost.end_date.getTime() - today.getTime()) / DAY));
  return round2(bid * remainingDays);
}

/** 向企业全员发送站内通知 */
export async function notifyCompanyMembers(companyId: string, payload: Omit<Parameters<typeof notifyUser>[0], 'userId'>) {
  const members = await prisma.companyMember.findMany({
    where: { company_id: companyId, status: 'ACTIVE' },
    select: { user_id: true },
  });
  for (const m of members) {
    await notifyUser({ ...payload, userId: m.user_id }).catch(() => undefined);
  }
}

/**
 * 竞品替换结算：同一城市下仅保留出价 Top3 的 ACTIVE 置顶，
 * 超出者置 EXPIRED + 释放剩余冻结 + 通知企业全员 BOOST_OVERTAKEN。
 */
export async function settleCityBoosts(city: string) {
  const actives = await prisma.jobBiddingBoost.findMany({
    where: { city, status: 'ACTIVE' },
    orderBy: [{ bid: 'desc' }, { start_date: 'asc' }],
    include: { job: { select: { title: true } } },
  });
  const toExpire = actives.slice(3);
  for (const b of toExpire) {
    await prisma.jobBiddingBoost.update({ where: { id: b.id }, data: { status: 'EXPIRED', paused_at: null } });
    await releaseBoostFunds(b.company_id, remainingFrozen(b, new Date()), `竞价置顶被替换-${b.job.title}`);
    await notifyCompanyMembers(b.company_id, {
      type: 'BOOST_OVERTAKEN',
      title: '置顶被替换',
      body: `您的置顶职位「${b.job.title}」已被更高出价替换，当前排名已退出前 3`,
      link: '/company/boosts',
    });
    log('info', 'boost:overtaken', { boostId: b.id, city });
  }
}

/** 每日扣费任务（00:00）：生效中置顶按天扣费，余额不足自动暂停并通知 */
export async function runDailyBoostCharges(today = new Date()) {
  const d = dayStart(today);
  const actives = await prisma.jobBiddingBoost.findMany({ where: { status: 'ACTIVE' }, include: { job: { select: { title: true } } } });
  const touchedCities = new Set<string>();
  for (const b of actives) {
    touchedCities.add(b.city);
    const bid = Number(b.bid);
    // 尚未到生效日期：跳过
    if (d.getTime() < dayStart(b.start_date).getTime()) continue;
    // 已过结束日期：标记过期
    if (d.getTime() > dayStart(b.end_date).getTime()) {
      await prisma.jobBiddingBoost.update({ where: { id: b.id }, data: { status: 'EXPIRED', paused_at: null } });
      continue;
    }
    // 正常扣费：锁定钱包，余额充足则扣，不足则暂停
    await prisma.$transaction(async (tx) => {
      const rows = (await tx.$queryRaw`SELECT * FROM "CompanyWallet" WHERE company_id = ${b.company_id}::uuid FOR UPDATE`) as any[];
      let wallet = rows[0];
      if (!wallet) wallet = await tx.companyWallet.create({ data: { company_id: b.company_id } });
      const balance = Number(wallet.balance);
      if (balance < bid - 0.001) {
        await tx.jobBiddingBoost.update({
          where: { id: b.id },
          data: { status: 'PAUSED', paused_at: new Date() },
        });
        await notifyCompanyMembers(b.company_id, {
          type: 'BOOST_BALANCE_LOW',
          title: '企业余额不足',
          body: `您的企业余额仅剩 ${round2(balance)} 元，竞价置顶「${b.job.title}」已暂停`,
          link: '/company/wallet',
        }).catch(() => undefined);
        log('info', 'boost:paused-no-balance', { boostId: b.id, balance });
        return;
      }
      const frozen = Math.max(0, Number(wallet.frozen) - bid);
      await tx.companyWallet.update({
        where: { company_id: b.company_id },
        data: {
          balance: round2(balance - bid),
          frozen: round2(frozen),
          total_consume: { increment: bid },
        },
      });
      await tx.walletTransaction.create({
        data: { company_id: b.company_id, type: 'CONSUME', amount: round2(bid), balance_after: round2(balance - bid), description: `竞价置顶扣费-${b.job.title}` },
      });
      await tx.jobBiddingBoost.update({
        where: { id: b.id },
        data: { total_cost: { increment: bid } },
      });
    });
  }
  for (const city of touchedCities) {
    await settleCityBoosts(city).catch((e) => log('error', 'boost:settle-failed', { city, error: e?.message }));
  }
  return actives.length;
}

/** 充值后自动恢复置顶：余额充足（balance >= bid）的 PAUSED 置顶恢复 ACTIVE，结束日期顺延暂停天数 */
export async function resumePausedBoosts(companyId: string) {
  const paused = await prisma.jobBiddingBoost.findMany({
    where: { company_id: companyId, status: 'PAUSED' },
    include: { job: { select: { title: true } } },
  });
  const wallet = await prisma.companyWallet.findUnique({ where: { company_id: companyId } });
  const balance = wallet ? Number(wallet.balance) : 0;
  const now = new Date();
  let resumed = 0;
  for (const b of paused) {
    if (balance < Number(b.bid) - 0.001) continue;
    let endDate = new Date(b.end_date);
    if (b.paused_at) {
      const pausedDays = Math.ceil((now.getTime() - b.paused_at.getTime()) / DAY);
      endDate = new Date(endDate.getTime() + pausedDays * DAY);
    }
    await prisma.jobBiddingBoost.update({
      where: { id: b.id },
      data: { status: 'ACTIVE', paused_at: null, end_date: endDate },
    });
    await notifyCompanyMembers(companyId, {
      type: 'BOOST_OVERTAKEN',
      title: '置顶已恢复',
      body: `您的置顶职位「${b.job.title}」余额已充足，已自动恢复生效`,
      link: '/company/boosts',
    }).catch(() => undefined);
    resumed++;
  }
  if (resumed > 0) {
    const cities = [...new Set(paused.map((b) => b.city))];
    for (const c of cities) await settleCityBoosts(c).catch(() => undefined);
  }
  return resumed;
}
