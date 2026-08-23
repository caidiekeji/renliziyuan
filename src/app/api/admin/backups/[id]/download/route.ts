import { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import { fail } from '@/lib/api/response';
import { requireAdmin } from '@/lib/auth/admin';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';

/** 下载备份文件 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;
  const { id } = await params;

  const backup = await prisma.dbBackup.findUnique({ where: { id } });
  if (!backup || backup.status !== 'OK') return fail('BACKUP_NOT_FOUND', '备份记录不存在或未就绪', 404);
  if (!fs.existsSync(backup.file_path)) return fail('BACKUP_FILE_MISSING', '备份文件缺失', 404);

  const buf = fs.readFileSync(backup.file_path);
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="backup-${path.basename(backup.file_path)}"`,
    },
  });
}