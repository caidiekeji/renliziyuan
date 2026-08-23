import { NextRequest } from 'next/server';
import { ok, fail, getClientIp } from '@/lib/api/response';
import { requireAdmin, auditLog } from '@/lib/auth/admin';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';

/** 处理举报（HANDLED / DISMISSED） */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const status = body.status;
  if (status !== 'HANDLED' && status !== 'DISMISSED') return fail('VALIDATION_ERROR', 'status 必须为 HANDLED 或 DISMISSED');
  const report = await prisma.report.findUnique({ where: { id } });
  if (!report) return fail('REPORT_NOT_FOUND', '举报不存在', 404);
  const updated = await prisma.report.update({ where: { id }, data: { status, handled_by: auth.admin.id } });
  await auditLog({ adminId: auth.admin.id, action: 'HANDLE_REPORT', targetType: 'REPORT', targetId: id, detail: { status }, ip: getClientIp(req) });
  return ok(updated);
}
