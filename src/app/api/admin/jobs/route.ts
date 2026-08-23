import { NextRequest } from 'next/server';
import { ok } from '@/lib/api/response';
import { requireAdmin } from '@/lib/auth/admin';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';

/** 职位列表（管理，含已删除恢复位） */
export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;
  const url = req.nextUrl;
  const keyword = url.searchParams.get('keyword')?.trim();
  const audit = url.searchParams.get('audit_status');
  const status = url.searchParams.get('status');
  const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get('pageSize')) || 20));

  const where: any = {};
  if (audit) where.audit_status = audit;
  if (status) where.status = status;
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
      include: { company: { select: { id: true, name: true } }, boosts: true },
    }),
  ]);
  return ok(items, { total, page, pageSize });
}
