import { NextRequest } from 'next/server';
import { ok, fail, handleError } from '@/lib/api/response';
import { requireAdmin, auditLog } from '@/lib/auth/admin';
import { prisma } from '@/lib/db/prisma';
import { walletAdjust } from '@/lib/wallet';

export const dynamic = 'force-dynamic';

/** 管理员手动调账（正数入账 / 负数扣减，须填原因，落审计） */
export async function POST(req: NextRequest, { params }: { params: Promise<{ companyId: string }> }) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;
  const { companyId } = await params;
  const body = await req.json().catch(() => ({}));
  const delta = Number(body.delta);
  const reason = String(body.reason || '').trim();
  if (!Number.isFinite(delta) || delta === 0) return fail('INVALID_DELTA', '调整金额不能为 0');
  if (!reason) return fail('REASON_REQUIRED', '请填写调账原因');

  const company = await prisma.company.findUnique({ where: { id: companyId }, select: { id: true, name: true } });
  if (!company) return fail('COMPANY_NOT_FOUND', '企业不存在', 404);

  try {
    await walletAdjust(companyId, delta, reason);
    await auditLog({
      adminId: auth.admin.id,
      action: delta > 0 ? 'WALLET_ADJUST_IN' : 'WALLET_ADJUST_OUT',
      targetType: 'WALLET',
      targetId: companyId,
      detail: { companyName: company.name, delta, reason },
    });
    return ok({ company_id: companyId, delta, reason });
  } catch (e: any) {
    if (e?.message === 'INSUFFICIENT_BALANCE') return fail('INSUFFICIENT_BALANCE', '余额不足，无法扣减', 400);
    return handleError(e);
  }
}
