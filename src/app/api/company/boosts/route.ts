import { NextRequest } from 'next/server';
import { ok, fail, created, handleError } from '@/lib/api/response';
import { getUserFromRequest, requireCompanyMember } from '@/lib/auth/session';
import { prisma } from '@/lib/db/prisma';
import { getSiteConfig } from '@/lib/config';
import { freezeBoostFunds, releaseBoostFunds } from '@/lib/boost';
import { auditLog } from '@/lib/auth/admin';
import { log } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/** 企业置顶列表（含状态/花费/出价） */
export async function GET(req: NextRequest) {
  const user = await getUserFromRequest();
  if (!user) return fail('UNAUTHORIZED', '未登录', 401);
  const companyId = req.headers.get('x-company-id');
  if (!companyId) return fail('INVALID_CONTEXT', '缺少企业上下文', 400);
  const { error } = await requireCompanyMember(user, companyId, 'HR');
  if (error) return error;

  const boosts = await prisma.jobBiddingBoost.findMany({
    where: { company_id: companyId },
    orderBy: { created_at: 'desc' },
    include: { job: { select: { id: true, title: true, is_hourly: true } } },
  });
  return ok(boosts);
}

/** 创建置顶（v2.1）：校验订阅/余额/限流后冻结并置 PENDING 待审核 */
export async function POST(req: NextRequest) {
  const user = await getUserFromRequest();
  if (!user) return fail('UNAUTHORIZED', '未登录', 401);
  const companyId = req.headers.get('x-company-id');
  if (!companyId) return fail('INVALID_CONTEXT', '缺少企业上下文', 400);
  const { member, error } = await requireCompanyMember(user, companyId, 'HR');
  if (!member) return error!;

  const body = await req.json().catch(() => ({}));
  const jobId = String(body.job_id || '');
  const city = String(body.city || '').trim();
  const jobType = body.job_type || null;
  const bid = Number(body.bid);
  const startDate = body.start_date ? new Date(body.start_date) : null;
  const endDate = body.end_date ? new Date(body.end_date) : null;
  if (!jobId || !city || !startDate || !endDate) return fail('VALIDATION_ERROR', '缺少职位/城市/投放日期');
  if (!Number.isFinite(bid) || bid <= 0) return fail('INVALID_BID', '出价必须大于 0');

  const cfg = await getSiteConfig();
  if (bid < Number(cfg.boost_min_bid)) return fail('BID_TOO_LOW', `出价不能低于最低限价 ${cfg.boost_min_bid} 元/天`, 400);
  const today = new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());
  if (startDate.getTime() < today.getTime()) return fail('INVALID_DATE', '开始日期不能早于今天');
  if (endDate.getTime() < startDate.getTime()) return fail('INVALID_DATE', '结束日期不能早于开始日期');

  // 职位归属 + 在招校验
  const job = await prisma.job.findFirst({ where: { id: jobId, company_id: companyId, deleted_at: null } });
  if (!job) return fail('JOB_NOT_FOUND', '职位不存在或不属于本企业', 404);
  if (job.status !== 'OPEN') return fail('JOB_NOT_ACTIVE', '职位未上线，不能置顶', 400);

  // 同一职位同一城市不能重复置顶（非终态记录存在即冲突）
  const existing = await prisma.jobBiddingBoost.findFirst({
    where: { job_id: jobId, city, status: { in: ['PENDING', 'ACTIVE', 'PAUSED'] } },
  });
  if (existing) return fail('BOOST_EXISTS', '该职位在该城市已存在置顶记录', 409);

  // 套餐支持校验（免费版无置顶；标准版 ≤3；旗舰版不限）
  const sub = await prisma.subscription.findFirst({
    where: { company_id: companyId, status: 'ACTIVE', end_at: { gt: new Date() } },
    include: { plan: true },
  });
  if (!sub?.plan.can_feature) return fail('FEATURE_NOT_ALLOWED', '当前套餐不支持竞价置顶', 403);
  if (sub.plan.job_limit !== 999999) {
    const activeCount = await prisma.jobBiddingBoost.count({
      where: { company_id: companyId, status: { in: ['ACTIVE', 'PENDING'] } },
    });
    if (activeCount >= 3) return fail('BOOST_LIMIT', '当前套餐最多 3 个竞价置顶', 403);
  }

  // 每日创建上限（同一企业同一职位同一城市）
  const dayStart = new Date(today);
  const createdToday = await prisma.jobBiddingBoost.count({
    where: { company_id: companyId, job_id: jobId, city, created_at: { gte: dayStart } },
  });
  if (createdToday >= cfg.boost_create_limit_per_day)
    return fail('TOO_MANY_REQUESTS', `每日最多创建 ${cfg.boost_create_limit_per_day} 次置顶`, 429);

  // 余额校验 + 冻结（bid × 投放天数）
  const days = Math.ceil((endDate.getTime() - startDate.getTime()) / 86_400_000) + 1;
  const totalCost = Math.round(bid * days * 100) / 100;
  try {
    await freezeBoostFunds(companyId, totalCost, `竞价置顶-${city}${job.title}`);
  } catch (e: any) {
    if (e?.message === 'INSUFFICIENT_BALANCE') return fail('INSUFFICIENT_BALANCE', '企业余额不足，请先充值', 400);
    return handleError(e);
  }

  let boost;
  try {
    boost = await prisma.jobBiddingBoost.create({
      data: {
        company_id: companyId,
        job_id: jobId,
        city,
        job_type: jobType || undefined,
        bid,
        status: 'PENDING',
        start_date: startDate,
        end_date: endDate,
        total_cost: 0,
      },
    });
  } catch (e) {
    // 创建失败：释放已冻结资金，避免资金悬挂
    await releaseBoostFunds(companyId, totalCost, `竞价置顶创建失败释放-${city}${job.title}`).catch(() => undefined);
    return handleError(e);
  }
  await auditLog({ adminId: user.id, action: 'CREATE_BOOST', targetType: 'BOOST', targetId: boost.id, detail: { companyId, jobId, city, bid, totalCost } });
  log('info', 'boost:created', { boostId: boost.id, companyId, totalCost });
  return created(boost);
}
