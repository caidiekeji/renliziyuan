import { NextRequest } from 'next/server';
import { ok, fail, handleError } from '@/lib/api/response';
import { getUserFromRequest, requireCompanyMember } from '@/lib/auth/session';
import { prisma } from '@/lib/db/prisma';
import { getSiteConfig } from '@/lib/config';
import { releaseBoostFunds, remainingFrozen, freezeBoostFunds } from '@/lib/boost';
import { auditLog } from '@/lib/auth/admin';
import { log } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/** 编辑置顶（仅 PENDING/PAUSED 可修改出价/日期；调整后重新冻结/释放差额） */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUserFromRequest();
  if (!user) return fail('UNAUTHORIZED', '未登录', 401);
  const { id } = await params;
  const boost = await prisma.jobBiddingBoost.findUnique({ where: { id }, include: { job: { select: { title: true } } } });
  if (!boost) return fail('BOOST_NOT_FOUND', '置顶记录不存在', 404);
  const { member, error } = await requireCompanyMember(user, boost.company_id, 'HR');
  if (!member) return error!;
  if (!['PENDING', 'PAUSED'].includes(boost.status)) return fail('NOT_EDITABLE', '仅审核中/暂停状态的置顶可编辑', 400);

  const body = await req.json().catch(() => ({}));
  const bid = body.bid != null ? Number(body.bid) : Number(boost.bid);
  const startDate = body.start_date ? new Date(body.start_date) : new Date(boost.start_date);
  const endDate = body.end_date ? new Date(body.end_date) : new Date(boost.end_date);
  if (!Number.isFinite(bid) || bid <= 0) return fail('INVALID_BID', '出价必须大于 0');

  const cfg = await getSiteConfig();
  if (bid < Number(cfg.boost_min_bid)) return fail('BID_TOO_LOW', `出价不能低于最低限价 ${cfg.boost_min_bid} 元/天`, 400);
  if (endDate.getTime() < startDate.getTime()) return fail('INVALID_DATE', '结束日期不能早于开始日期');

  // 调整冻结额：释放旧剩余，按新参数冻结；冻结失败时恢复旧冻结额，避免资金悬挂
  const today = new Date();
  const oldRemaining = remainingFrozen({ bid: Number(boost.bid), end_date: boost.end_date }, today);
  await releaseBoostFunds(boost.company_id, oldRemaining, `编辑置顶释放-${boost.job.title}`);
  const days = Math.ceil((endDate.getTime() - startDate.getTime()) / 86_400_000) + 1;
  const newTotal = Math.round(bid * days * 100) / 100;
  try {
    await freezeBoostFunds(boost.company_id, newTotal, `竞价置顶-${boost.city}${boost.job.title}`);
  } catch (e: any) {
    // 回滚：恢复旧冻结额（best-effort），失败仅告警避免死循环
    await freezeBoostFunds(boost.company_id, oldRemaining, `编辑置顶回滚-${boost.job.title}`).catch((e2) => {
      log('error', 'boost:edit-rollback-failed', { boostId: id, companyId: boost.company_id, oldRemaining, error: e2?.message });
    });
    if (e?.message === 'INSUFFICIENT_BALANCE') return fail('INSUFFICIENT_BALANCE', '企业余额不足，请先充值', 400);
    return handleError(e);
  }

  const updated = await prisma.jobBiddingBoost.update({
    where: { id },
    data: { bid, start_date: startDate, end_date: endDate },
  });
  await auditLog({ adminId: user.id, action: 'EDIT_BOOST', targetType: 'BOOST', targetId: id, detail: { bid, startDate, endDate, newTotal } });
  return ok(updated);
}

/** 取消置顶（仅 PENDING/PAUSED 可删；物理删除 + 释放冻结 + 计入每日取消上限） */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUserFromRequest();
  if (!user) return fail('UNAUTHORIZED', '未登录', 401);
  const { id } = await params;
  const boost = await prisma.jobBiddingBoost.findUnique({ where: { id }, include: { job: { select: { title: true } } } });
  if (!boost) return fail('BOOST_NOT_FOUND', '置顶记录不存在', 404);
  const { member, error } = await requireCompanyMember(user, boost.company_id, 'HR');
  if (!member) return error!;
  if (!['PENDING', 'PAUSED'].includes(boost.status)) return fail('NOT_CANCELLABLE', '仅审核中/暂停状态的置顶可取消', 400);

  // 每日取消上限（同一企业同一职位）
  const cfg = await getSiteConfig();
  const dayStart = new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());
  const cancelledToday = await prisma.auditLog.count({
    where: { admin_id: user.id, action: 'CANCEL_BOOST', created_at: { gte: dayStart } },
  });
  if (cancelledToday >= cfg.boost_cancel_limit_per_day)
    return fail('TOO_MANY_REQUESTS', `每日最多取消 ${cfg.boost_cancel_limit_per_day} 次置顶`, 429);

  const remaining = remainingFrozen({ bid: Number(boost.bid), end_date: boost.end_date }, new Date());
  await releaseBoostFunds(boost.company_id, remaining, `取消置顶释放-${boost.job.title}`);
  await prisma.jobBiddingBoost.delete({ where: { id } });
  await auditLog({ adminId: user.id, action: 'CANCEL_BOOST', targetType: 'BOOST', targetId: id, detail: { companyId: boost.company_id, jobId: boost.job_id } });
  log('info', 'boost:cancelled', { boostId: id });
  return ok({ id }, { message: '已取消置顶' });
}
