import { NextRequest } from 'next/server';
import { ok, fail } from '@/lib/api/response';
import { getUserFromRequest, requireCompanyMember } from '@/lib/auth/session';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';

/** 企业余额交易记录（分页） */
export async function GET(req: NextRequest) {
  const user = await getUserFromRequest();
  if (!user) return fail('UNAUTHORIZED', '未登录', 401);
  const companyId = req.headers.get('x-company-id');
  if (!companyId) return fail('INVALID_CONTEXT', '缺少企业上下文', 400);
  const { error } = await requireCompanyMember(user, companyId, 'HR');
  if (error) return error;

  const url = new URL(req.url);
  const type = url.searchParams.get('type');
  const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
  const pageSize = Math.min(50, Math.max(1, Number(url.searchParams.get('pageSize')) || 20));

  const where: any = { company_id: companyId };
  if (type) where.type = type;

  const [total, items] = await Promise.all([
    prisma.walletTransaction.count({ where }),
    prisma.walletTransaction.findMany({
      where,
      orderBy: { created_at: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);
  return ok(items, { total, page, pageSize });
}
