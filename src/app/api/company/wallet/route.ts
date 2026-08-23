import { NextRequest } from 'next/server';
import { ok, fail } from '@/lib/api/response';
import { getUserFromRequest, requireCompanyMember } from '@/lib/auth/session';
import { getOrCreateWallet } from '@/lib/wallet';

export const dynamic = 'force-dynamic';

/** 查询企业余额（balance/frozen/total_recharge/total_consume） */
export async function GET(req: NextRequest) {
  const user = await getUserFromRequest();
  if (!user) return fail('UNAUTHORIZED', '未登录', 401);
  const companyId = req.headers.get('x-company-id');
  if (!companyId) return fail('INVALID_CONTEXT', '缺少企业上下文', 400);
  const { error } = await requireCompanyMember(user, companyId, 'HR');
  if (error) return error;

  const wallet = await getOrCreateWallet(companyId);
  return ok(wallet);
}
