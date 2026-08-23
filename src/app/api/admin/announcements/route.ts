import { NextRequest } from 'next/server';
import { ok, created, fail, handleError, getClientIp } from '@/lib/api/response';
import { requireAdmin, auditLog } from '@/lib/auth/admin';
import { prisma } from '@/lib/db/prisma';
import { announcementSchema } from '@/lib/validators/zod';

export const dynamic = 'force-dynamic';

/** 公告列表（含 inactive，可按 type 过滤） */
export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;
  const type = req.nextUrl.searchParams.get('type');
  const where: any = {};
  if (type === 'BANNER' || type === 'NOTICE') where.type = type;
  const items = await prisma.announcement.findMany({
    where,
    orderBy: [{ sort: 'desc' }, { created_at: 'desc' }],
  });
  return ok(items);
}

/** 新增公告 */
export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;
  const parsed = announcementSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return fail('VALIDATION_ERROR', parsed.error.issues[0]?.message || '参数错误');
  const data: any = { ...parsed.data };
  if (data.start_at) data.start_at = new Date(data.start_at);
  if (data.end_at) data.end_at = new Date(data.end_at);
  try {
    const item = await prisma.announcement.create({ data });
    await auditLog({ adminId: auth.admin.id, action: 'CREATE_ANNOUNCEMENT', targetType: 'ANNOUNCEMENT', targetId: item.id, detail: data, ip: getClientIp(req) });
    return created(item);
  } catch (e) {
    return handleError(e);
  }
}
