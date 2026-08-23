import { NextRequest } from 'next/server';
import { ok, created, fail, handleError, getClientIp } from '@/lib/api/response';
import { requireAdmin, auditLog } from '@/lib/auth/admin';
import { prisma } from '@/lib/db/prisma';
import { navMenuSchema } from '@/lib/validators/zod';
import { invalidateCache } from '@/lib/config';

export const dynamic = 'force-dynamic';

/** 栏目列表（含停用项，按 sort 升序） */
export async function GET() {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;
  const list = await prisma.navMenu.findMany({
    orderBy: [{ sort: 'asc' }, { created_at: 'asc' }],
  });
  return ok(list);
}

/** 新增栏目 */
export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;
  const parsed = navMenuSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return fail('VALIDATION_ERROR', parsed.error.issues[0]?.message || '参数错误');
  try {
    const item = await prisma.navMenu.create({ data: parsed.data });
    invalidateCache(['nav_menus']);
    await auditLog({ adminId: auth.admin.id, action: 'CREATE_NAV_MENU', targetType: 'NAV_MENU', targetId: item.id, detail: parsed.data, ip: getClientIp(req) });
    return created(item);
  } catch (e) {
    return handleError(e);
  }
}