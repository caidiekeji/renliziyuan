import { NextRequest } from 'next/server';
import { z } from 'zod';
import { ok, fail, handleError, getClientIp } from '@/lib/api/response';
import { requireAdmin, auditLog } from '@/lib/auth/admin';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';

const backupConfigSchema = z.object({
  auto_enabled: z.boolean().optional(),
  schedule_cron: z.string().max(50).optional(),
  backup_type: z.enum(['FULL', 'SCHEMA_DATA']).optional(),
  storage_driver: z.string().max(20).optional(),
  encrypt: z.boolean().optional(),
  retention_count: z.coerce.number().int().min(1).optional(),
  retention_days: z.coerce.number().int().min(1).optional(),
});

/** 备份配置 + 最近备份记录 */
export async function GET() {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;
  const config = await prisma.backupConfig.findUnique({ where: { id: 1 } });
  const recentBackups = await prisma.dbBackup.findMany({ orderBy: { created_at: 'desc' }, take: 10 });
  return ok({ config, recentBackups });
}

/** 更新备份配置 */
export async function PUT(req: NextRequest) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;
  const parsed = backupConfigSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return fail('VALIDATION_ERROR', parsed.error.issues[0]?.message || '参数错误');
  try {
    const config = await prisma.backupConfig.update({ where: { id: 1 }, data: parsed.data });
    await auditLog({ adminId: auth.admin.id, action: 'UPDATE_BACKUP_CONFIG', targetType: 'BACKUP_CONFIG', targetId: '1', detail: parsed.data, ip: getClientIp(req) });
    return ok(config);
  } catch (e) {
    return handleError(e);
  }
}
