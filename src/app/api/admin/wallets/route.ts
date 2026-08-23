import { NextRequest } from 'next/server';
import { ok } from '@/lib/api/response';
import { requireAdmin } from '@/lib/auth/admin';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';

/** 企业余额列表（含企业信息，可搜索企业名） */
export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;
  const url = req.nextUrl;
  const keyword = url.searchParams.get('keyword')?.trim();
  const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get('pageSize')) || 20));

  const where: any = {};
  if (keyword) where.company = { name: { contains: keyword, mode: 'insensitive' } };

  const [total, items] = await Promise.all([
    prisma.companyWallet.count({ where }),
    prisma.companyWallet.findMany({
      where,
      orderBy: { updated_at: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { company: { select: { id: true, name: true, verify_status: true } } },
    }),
  ]);
  return ok(items, { total, page, pageSize });
}
