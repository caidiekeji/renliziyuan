import { NextRequest } from 'next/server';
import { ok } from '@/lib/api/response';
import { requireAdmin } from '@/lib/auth/admin';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';

/** 置顶列表（审核中/生效中/已暂停/已过期） */
export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;
  const url = req.nextUrl;
  const status = url.searchParams.get('status');
  const companyId = url.searchParams.get('company_id');
  const city = url.searchParams.get('city');
  const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get('pageSize')) || 20));

  const where: any = {};
  if (status) where.status = status;
  if (companyId) where.company_id = companyId;
  if (city) where.city = city;

  const [total, items] = await Promise.all([
    prisma.jobBiddingBoost.count({ where }),
    prisma.jobBiddingBoost.findMany({
      where,
      orderBy: { created_at: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        company: { select: { id: true, name: true, verify_status: true } },
        job: { select: { id: true, title: true, status: true } },
      },
    }),
  ]);
  return ok(items, { total, page, pageSize });
}
