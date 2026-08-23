import { NextRequest } from 'next/server';
import { ok, fail, getClientIp } from '@/lib/api/response';
import { requireAdmin, auditLog } from '@/lib/auth/admin';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';

/** 删除备份记录 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;
  const { id } = await params;
  const backup = await prisma.dbBackup.findUnique({ where: { id } });
  if (!backup) return fail('BACKUP_NOT_FOUND', '备份记录不存在', 404);
  await prisma.dbBackup.delete({ where: { id } });
  await auditLog({ adminId: auth.admin.id, action: 'DELETE_BACKUP', targetType: 'DB_BACKUP', targetId: id, ip: getClientIp(req) });
  return ok({ success: true });
}
