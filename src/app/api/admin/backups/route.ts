import { NextRequest } from 'next/server';
import { ok, created, fail, getClientIp } from '@/lib/api/response';
import { requireAdmin, auditLog } from '@/lib/auth/admin';
import { prisma } from '@/lib/db/prisma';
import { createBackup } from '@/lib/backup';

export const dynamic = 'force-dynamic';

/** 备份记录列表（分页） */
export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;
  const page = Math.max(1, Number(req.nextUrl.searchParams.get('page')) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(req.nextUrl.searchParams.get('pageSize')) || 20));
  const [total, items] = await Promise.all([
    prisma.dbBackup.count(),
    prisma.dbBackup.findMany({
      orderBy: { created_at: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { creator: { select: { id: true, name: true } } },
    }),
  ]);
  return ok(items, { total, page, pageSize });
}

/** 创建手动备份（真实 pg_dump） */
export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;
  try {
    const backup = await createBackup({ type: 'MANUAL', createdBy: auth.admin.id });
    await auditLog({ adminId: auth.admin.id, action: 'CREATE_BACKUP', targetType: 'DB_BACKUP', targetId: backup.id, detail: { file_path: backup.file_path, file_size: backup.file_size?.toString() }, ip: getClientIp(req) });
    return created(backup);
  } catch (e: any) {
    return fail('BACKUP_FAILED', e?.message || '备份失败', 500);
  }
}
