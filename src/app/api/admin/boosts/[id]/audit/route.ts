import { NextRequest } from 'next/server';
import { ok, fail, handleError } from '@/lib/api/response';
import { requireAdmin, auditLog } from '@/lib/auth/admin';
import { prisma } from '@/lib/db/prisma';
import { releaseBoostFunds, remainingFrozen, settleCityBoosts } from '@/lib/boost';
import { notifyUser } from '@/lib/notification';

export const dynamic = 'force-dynamic';

/**
 * 审核置顶：APPROVED 生效 / REJECTED 驳回（附理由，驳回释放冻结）
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const result = String(body.result || '').toUpperCase();
  const reason = String(body.reason || '').trim();
  if (!['APPROVED', 'REJECTED'].includes(result)) return fail('INVALID_RESULT', '审核结果必须为 APPROVED/REJECTED');
  if (result === 'REJECTED' && !reason) return fail('REASON_REQUIRED', '驳回需填写理由');

  const boost = await prisma.jobBiddingBoost.findUnique({ where: { id }, include: { job: { select: { title: true } }, company: { select: { name: true } } } });
  if (!boost) return fail('BOOST_NOT_FOUND', '置顶记录不存在', 404);
  if (boost.status !== 'PENDING') return fail('NOT_PENDING', '仅审核中的置顶可审核', 400);

  try {
    if (result === 'APPROVED') {
      const updated = await prisma.jobBiddingBoost.update({ where: { id }, data: { status: 'ACTIVE' } });
      await settleCityBoosts(boost.city).catch(() => undefined);
      await notifyBoostAudit(boost.company_id, '已通过');
      await auditLog({ adminId: auth.admin.id, action: 'AUDIT_BOOST', targetType: 'BOOST', targetId: id, detail: { result: 'APPROVED' } });
      return ok(updated);
    }
    // REJECTED：释放冻结
    await releaseBoostFunds(boost.company_id, remainingFrozen(boost, new Date()), `置顶驳回释放-${boost.job.title}`);
    const updated = await prisma.jobBiddingBoost.update({ where: { id }, data: { status: 'REJECTED' } });
    await notifyBoostAudit(boost.company_id, `未通过：${reason}`);
    await auditLog({ adminId: auth.admin.id, action: 'AUDIT_BOOST', targetType: 'BOOST', targetId: id, detail: { result: 'REJECTED', reason } });
    return ok(updated);
  } catch (e) {
    return handleError(e);
  }
}

async function notifyBoostAudit(companyId: string, resultText: string) {
  const members = await prisma.companyMember.findMany({ where: { company_id: companyId, status: 'ACTIVE' }, select: { user_id: true } });
  for (const m of members) {
    await notifyUser({ userId: m.user_id, type: 'SYSTEM', title: '置顶审核结果', body: `您的竞价置顶申请${resultText}`, link: '/company/boosts' }).catch(() => undefined);
  }
}
