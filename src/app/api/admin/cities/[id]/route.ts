import { NextRequest } from 'next/server';
import { ok, fail, handleError, getClientIp } from '@/lib/api/response';
import { requireAdmin, auditLog } from '@/lib/auth/admin';
import { prisma } from '@/lib/db/prisma';
import { citySchema } from '@/lib/validators/zod';

export const dynamic = 'force-dynamic';

/** 更新城市（部分字段） */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;
  const { id } = await params;
  const parsed = citySchema.partial().safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return fail('VALIDATION_ERROR', parsed.error.issues[0]?.message || '参数错误');
  try {
    const item = await prisma.city.update({ where: { id }, data: parsed.data });
    await auditLog({ adminId: auth.admin.id, action: 'UPDATE_CITY', targetType: 'CITY', targetId: id, detail: parsed.data, ip: getClientIp(req) });
    return ok(item);
  } catch (e) {
    return handleError(e);
  }
}

/** 删除城市 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;
  const { id } = await params;
  try {
    await prisma.city.delete({ where: { id } });
    await auditLog({ adminId: auth.admin.id, action: 'DELETE_CITY', targetType: 'CITY', targetId: id, ip: getClientIp(req) });
    return ok({ success: true });
  } catch (e) {
    return handleError(e);
  }
}
