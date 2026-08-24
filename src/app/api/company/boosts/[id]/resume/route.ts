import { NextRequest } from 'next/server';
import { ok, fail } from '@/lib/api/response';
import { getUserFromRequest, requireCompanyMember } from '@/lib/auth/session';
import { prisma } from '@/lib/db/prisma';
import { settleCityBoosts } from '@/lib/boost';

export const dynamic = 'force-dynamic';

/** 恢复置顶（仅 PAUSED 可恢复；余额需充足） */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUserFromRequest();
  if (!user) return fail('UNAUTHORIZED', '未登录', 401);
  const { id } = await params;
  const boost = await prisma.jobBiddingBoost.findUnique({ where: { id } });
  if (!boost) return fail('BOOST_NOT_FOUND', '置顶记录不存在', 404);
  const { member, error } = await requireCompanyMember(user, boost.company_id, 'HR');
  if (!member) return error!;
  if (boost.status !== 'PAUSED') return fail('NOT_RESUMABLE', '仅暂停中的置顶可恢复', 400);

  // 余额检查 + 状态更新放同一事务（企业钱包行锁），防并发穿透导致余额为负
  try {
    const updated = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "CompanyWallet" WHERE company_id = ${boost.company_id}::uuid FOR UPDATE`;
      const wallet = await tx.companyWallet.findUnique({ where: { company_id: boost.company_id } });
      if (!wallet || Number(wallet.balance) < Number(boost.bid)) throw new Error('INSUFFICIENT_BALANCE');
      // 顺延暂停天数
      let endDate = new Date(boost.end_date);
      if (boost.paused_at) {
        const pausedDays = Math.ceil((new Date().getTime() - boost.paused_at.getTime()) / 86_400_000);
        endDate = new Date(endDate.getTime() + pausedDays * 86_400_000);
      }
      return tx.jobBiddingBoost.update({
        where: { id },
        data: { status: 'ACTIVE', paused_at: null, end_date: endDate },
      });
    });
    await settleCityBoosts(boost.city).catch(() => undefined);
    return ok(updated);
  } catch (e: any) {
    if (e?.message === 'INSUFFICIENT_BALANCE') return fail('INSUFFICIENT_BALANCE', '企业余额不足，请先充值', 400);
    throw e;
  }
}
