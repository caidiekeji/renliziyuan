import { NextRequest } from 'next/server';
import { ok, fail } from '@/lib/api/response';
import { requireAdmin } from '@/lib/auth/admin';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';

/** 企业余额交易流水（可按类型筛选） */
export async function GET(req: NextRequest, { params }: { params: Promise<{ companyId: string }> }) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;
  const { companyId } = await params;
  const company = await prisma.company.findUnique({ where: { id: companyId }, select: { id: true } });
  if (!company) return fail('COMPANY_NOT_FOUND', '企业不存在', 404);

  const url = req.nextUrl;
  const type = url.searchParams.get('type');
  const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get('pageSize')) || 20));

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
