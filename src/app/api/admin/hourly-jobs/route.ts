import { NextRequest } from 'next/server';
import { ok } from '@/lib/api/response';
import { requireAdmin } from '@/lib/auth/admin';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';

/** 小时工职位列表（含报名数） */
export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;
  const url = req.nextUrl;
  const status = url.searchParams.get('status');
  const companyId = url.searchParams.get('company_id');
  const keyword = url.searchParams.get('keyword')?.trim();
  const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get('pageSize')) || 20));

  const where: any = { is_hourly: true };
  if (status) where.status = status;
  if (companyId) where.company_id = companyId;
  if (keyword) {
    where.OR = [
      { title: { contains: keyword, mode: 'insensitive' } },
      { company: { name: { contains: keyword, mode: 'insensitive' } } },
    ];
  }

  const [total, items] = await Promise.all([
    prisma.job.count({ where }),
    prisma.job.findMany({
      where,
      orderBy: { created_at: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        company: { select: { id: true, name: true } },
        hourly_applications: { select: { status: true } },
      },
    }),
  ]);
  return ok(items, { total, page, pageSize });
}
