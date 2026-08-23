import { NextRequest } from 'next/server';
import { ok, fail, handleError, getClientIp } from '@/lib/api/response';
import { requireAdmin, auditLog } from '@/lib/auth/admin';
import { prisma } from '@/lib/db/prisma';
import { jobTitleSchema } from '@/lib/validators/zod';

export const dynamic = 'force-dynamic';

/** 职位名称批量导入（按 code 去重，upsert） */
export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;
  const body = await req.json().catch(() => ({}));
  const rows: any[] = Array.isArray(body.rows) ? body.rows : [];
  if (rows.length === 0) return fail('VALIDATION_ERROR', 'rows 不能为空');
  const parsedRows = rows.map((r) => jobTitleSchema.safeParse(r));
  const invalid = parsedRows.find((p) => !p.success);
  if (invalid && !invalid.success) return fail('VALIDATION_ERROR', invalid.error.issues[0]?.message || '参数错误');
  let created = 0;
  let updated = 0;
  try {
    for (const p of parsedRows) {
      if (!p.success) continue;
      const { code } = p.data;
      const existing = await prisma.jobTitle.findUnique({ where: { code } });
      if (existing) {
        await prisma.jobTitle.update({ where: { code }, data: p.data });
        updated++;
      } else {
        await prisma.jobTitle.create({ data: p.data });
        created++;
      }
    }
    await auditLog({ adminId: auth.admin.id, action: 'IMPORT_JOB_TITLES', targetType: 'JOB_TITLE', detail: { created, updated, total: rows.length }, ip: getClientIp(req) });
    return ok({ created, updated });
  } catch (e) {
    return handleError(e);
  }
}
