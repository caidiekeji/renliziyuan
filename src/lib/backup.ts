import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import { prisma } from '@/lib/db/prisma';
import { log } from '@/lib/logger';
import { invalidateCache } from '@/lib/config';

const execFileAsync = promisify(execFile);
const BACKUP_DIR = process.env.BACKUP_DIR || path.join(process.cwd(), '.backups');

function dbEnv(): NodeJS.ProcessEnv {
  const url = process.env.DATABASE_URL || '';
  const u = new URL(url);
  const database = (u.pathname || '/').replace(/^\//, '').split('?')[0];
  return {
    ...process.env,
    PGPASSWORD: decodeURIComponent(u.password || ''),
    PGUSER: decodeURIComponent(u.username || ''),
    PGHOST: u.hostname || 'localhost',
    PGPORT: String(u.port || 5432),
    PGDATABASE: database,
  };
}

function ensureDir(): string {
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
  return BACKUP_DIR;
}

async function runDump(filePath: string): Promise<void> {
  const env = dbEnv();
  await execFileAsync('pg_dump', ['-Fc', '--no-owner', '-f', filePath, env.PGDATABASE as string], {
    env,
    maxBuffer: 128 * 1024 * 1024,
  });
}

async function runRestore(filePath: string): Promise<void> {
  const env = dbEnv();
  await execFileAsync(
    'pg_restore',
    ['--clean', '--if-exists', '--no-owner', '--no-privileges', '-d', env.PGDATABASE as string, filePath],
    { env, maxBuffer: 128 * 1024 * 1024 }
  );
}

/** 数据库连通性健康校验 */
async function healthCheck(): Promise<boolean> {
  try {
    const env = dbEnv();
    await execFileAsync('psql', ['-d', env.PGDATABASE as string, '-c', 'SELECT 1'], {
      env,
      maxBuffer: 1024 * 1024,
    });
    return true;
  } catch {
    return false;
  }
}

async function setMaintenance(on: boolean, msg = '系统维护中：数据恢复中，请稍候') {
  await prisma.siteConfig.update({ where: { id: 1 }, data: { maintenance_mode: on, maintenance_msg: on ? msg : null } });
  invalidateCache(['site_config']);
}

/** 执行真实 pg_dump 备份并落库记录 */
export async function createBackup(params: {
  type: 'MANUAL' | 'AUTO' | 'PRE_RESTORE_SNAPSHOT';
  createdBy?: string;
  note?: string;
}) {
  const dir = ensureDir();
  const filePath = path.join(dir, `${params.type.toLowerCase()}-${Date.now()}.dump`);
  const record = await prisma.dbBackup.create({
    data: {
      type: params.type,
      format: 'CUSTOM',
      storage_driver: 'local',
      file_path: filePath,
      status: 'RUNNING',
      note: params.note,
      created_by: params.createdBy,
    },
  });

  try {
    await runDump(filePath);
    const size = fs.statSync(filePath).size;
    const updated = await prisma.dbBackup.update({
      where: { id: record.id },
      data: { status: 'OK', file_size: BigInt(size) },
    });
    log('info', 'backup:created', { id: record.id, filePath, size });
    return updated;
  } catch (e: any) {
    await prisma.dbBackup.update({
      where: { id: record.id },
      data: { status: 'FAILED', note: e?.message?.slice(0, 200) },
    });
    log('error', 'backup:create-failed', { id: record.id, error: e?.message });
    throw e;
  }
}

export type RestoreResult =
  | { ok: true; snapshotId: string }
  | { ok: false; error: string; stage: 'validate' | 'snapshot' | 'restore' | 'rollback' };

/** 一键恢复：维护模式 + 恢复前快照 + pg_restore + 健康校验 + 失败回滚 / 只读兜底 */
export async function restoreBackup(id: string, adminId: string): Promise<RestoreResult> {
  const backup = await prisma.dbBackup.findUnique({ where: { id } });
  if (!backup || backup.status !== 'OK') return { ok: false, error: 'BACKUP_NOT_READY', stage: 'validate' };
  if (!fs.existsSync(backup.file_path)) return { ok: false, error: 'BACKUP_FILE_MISSING', stage: 'validate' };

  const cfg = await prisma.siteConfig.findUnique({ where: { id: 1 } });
  const prevMaintenance = cfg?.maintenance_mode ?? false;
  await setMaintenance(true);

  // 恢复前快照（用于失败回滚）
  let snapshot: Awaited<ReturnType<typeof createBackup>> | null = null;
  try {
    snapshot = await createBackup({ type: 'PRE_RESTORE_SNAPSHOT', createdBy: adminId, note: `restore ${id} pre-snapshot` });
  } catch (e: any) {
    log('error', 'backup:snapshot-failed', { id, error: e?.message });
    await setMaintenance(prevMaintenance);
    return { ok: false, error: 'SNAPSHOT_FAILED', stage: 'snapshot' };
  }

  // 执行恢复
  try {
    await runRestore(backup.file_path);
  } catch (e: any) {
    log('error', 'backup:restore-failed', { id, error: e?.message });
    return rollback(snapshot, prevMaintenance);
  }

  // 恢复后健康校验
  if (!(await healthCheck())) {
    log('error', 'backup:restore-health-failed', { id });
    return rollback(snapshot, prevMaintenance);
  }

  await setMaintenance(prevMaintenance);
  log('info', 'backup:restored', { id, snapshotId: snapshot.id });
  return { ok: true, snapshotId: snapshot.id };
}

async function rollback(snapshot: { file_path: string }, prevMaintenance: boolean): Promise<RestoreResult> {
  try {
    await runRestore(snapshot.file_path);
    if (await healthCheck()) {
      await setMaintenance(prevMaintenance);
      return { ok: false, error: 'RESTORE_FAILED_ROLLED_BACK', stage: 'restore' };
    }
  } catch (e: any) {
    log('error', 'backup:rollback-failed', { error: e?.message });
  }
  // 二次回滚仍失败：保持只读维护模式，等待人工介入
  await prisma.siteConfig.update({
    where: { id: 1 },
    data: { maintenance_mode: true, maintenance_msg: '系统维护中：数据恢复异常，已进入只读模式' },
  });
  invalidateCache(['site_config']);
  return { ok: false, error: 'RESTORE_CATASTROPHIC_READONLY', stage: 'rollback' };
}