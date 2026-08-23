import { NextRequest } from 'next/server';
import { ok, fail, handleError, getClientIp } from '@/lib/api/response';
import { requireAdmin, auditLog } from '@/lib/auth/admin';
import { prisma } from '@/lib/db/prisma';
import { announcementSchema } from '@/lib/validators/zod';

export const dynamic = 'force-dynamic';

/** 更新公告（部分字段） */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;
  const { id } = await params;
  const parsed = announcementSchema.partial().safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return fail('VALIDATION_ERROR', parsed.error.issues[0]?.message || '参数错误');
  const data: any = { ...parsed.data };
  if (data.start_at) data.start_at = new Date(data.start_at);
  if (data.end_at) data.end_at = new Date(data.end_at);
  try {
    const item = await prisma.announcement.update({ where: { id }, data });
    await auditLog({ adminId: auth.admin.id, action: 'UPDATE_ANNOUNCEMENT', targetType: 'ANNOUNCEMENT', targetId: id, detail: data, ip: getClientIp(req) });
    return ok(item);
  } catch (e) {
    return handleError(e);
  }
}

/** 删除公告 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;
  const { id } = await params;
  try {
    await prisma.announcement.delete({ where: { id } });
    await auditLog({ adminId: auth.admin.id, action: 'DELETE_ANNOUNCEMENT', targetType: 'ANNOUNCEMENT', targetId: id, ip: getClientIp(req) });
    return ok({ success: true });
  } catch (e) {
    return handleError(e);
  }
}
