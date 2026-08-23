import { NextRequest } from 'next/server';
import { ok, fail, handleError, getClientIp } from '@/lib/api/response';
import { requireAdmin, auditLog } from '@/lib/auth/admin';
import { prisma } from '@/lib/db/prisma';
import { navMenuSchema } from '@/lib/validators/zod';
import { invalidateCache } from '@/lib/config';

export const dynamic = 'force-dynamic';

/** 更新栏目（部分字段） */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;
  const { id } = await params;
  const parsed = navMenuSchema.partial().safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return fail('VALIDATION_ERROR', parsed.error.issues[0]?.message || '参数错误');
  try {
    const item = await prisma.navMenu.update({ where: { id }, data: parsed.data });
    invalidateCache(['nav_menus']);
    await auditLog({ adminId: auth.admin.id, action: 'UPDATE_NAV_MENU', targetType: 'NAV_MENU', targetId: id, detail: parsed.data, ip: getClientIp(req) });
    return ok(item);
  } catch (e) {
    return handleError(e);
  }
}

/** 删除栏目 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;
  const { id } = await params;
  try {
    await prisma.navMenu.delete({ where: { id } });
    invalidateCache(['nav_menus']);
    await auditLog({ adminId: auth.admin.id, action: 'DELETE_NAV_MENU', targetType: 'NAV_MENU', targetId: id, ip: getClientIp(req) });
    return ok({ success: true });
  } catch (e) {
    return handleError(e);
  }
}