import { NextRequest } from 'next/server';
import { ok, fail, getClientIp } from '@/lib/api/response';
import { requireAdmin, auditLog } from '@/lib/auth/admin';
import { restoreBackup } from '@/lib/backup';

export const dynamic = 'force-dynamic';

/** 一键恢复备份（维护模式 + 快照 + 健康校验 + 失败回滚/只读兜底） */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;
  const { id } = await params;

  const result = await restoreBackup(id, auth.admin.id);
  await auditLog({
    adminId: auth.admin.id,
    action: 'RESTORE_BACKUP',
    targetType: 'DB_BACKUP',
    targetId: id,
    detail: result,
    ip: getClientIp(req),
  });

  if (!result.ok) {
    const msgMap: Record<string, string> = {
      BACKUP_NOT_READY: '备份记录未就绪',
      BACKUP_FILE_MISSING: '备份文件缺失',
      SNAPSHOT_FAILED: '恢复前快照创建失败，已退出维护模式',
      RESTORE_FAILED_ROLLED_BACK: '恢复失败，已自动回滚到恢复前状态',
      RESTORE_CATASTROPHIC_READONLY: '恢复失败且回滚异常，系统已进入只读维护模式，请人工处理',
    };
    const status = result.stage === 'validate' ? 400 : 500;
    return fail(result.error, msgMap[result.error] || '恢复失败', status);
  }

  return ok({ success: true, snapshot_id: result.snapshotId });
}