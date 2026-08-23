import { NextRequest } from 'next/server';
import { ok } from '@/lib/api/response';
import { requireAdmin } from '@/lib/auth/admin';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';

/** 操作审计日志列表（action/admin_id 过滤 + 分页） */
export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;
  const action = req.nextUrl.searchParams.get('action');
  const adminId = req.nextUrl.searchParams.get('admin_id');
  const page = Math.max(1, Number(req.nextUrl.searchParams.get('page')) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(req.nextUrl.searchParams.get('pageSize')) || 20));
  const where: any = {};
  if (action) where.action = action;
  if (adminId) where.admin_id = adminId;
  const [total, items] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      orderBy: { created_at: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { admin: { select: { id: true, name: true } } },
    }),
  ]);
  return ok(items, { total, page, pageSize });
}
