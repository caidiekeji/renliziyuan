import { NextRequest } from 'next/server';
import { ok, created, fail, handleError, getClientIp } from '@/lib/api/response';
import { requireAdmin, auditLog } from '@/lib/auth/admin';
import { prisma } from '@/lib/db/prisma';
import { citySchema } from '@/lib/validators/zod';

export const dynamic = 'force-dynamic';

/** 城市列表（province 过滤，分页） */
export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;
  const url = req.nextUrl;
  const province = url.searchParams.get('province')?.trim();
  const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get('pageSize')) || 20));

  const where: any = {};
  if (province) where.province = province;
  const [total, items] = await Promise.all([
    prisma.city.count({ where }),
    prisma.city.findMany({
      where,
      orderBy: [{ province: 'asc' }, { name: 'asc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);
  return ok(items, { total, page, pageSize });
}

/** 新增城市 */
export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;
  const parsed = citySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return fail('VALIDATION_ERROR', parsed.error.issues[0]?.message || '参数错误');
  try {
    const item = await prisma.city.create({ data: parsed.data });
    await auditLog({ adminId: auth.admin.id, action: 'CREATE_CITY', targetType: 'CITY', targetId: item.id, detail: parsed.data, ip: getClientIp(req) });
    return created(item);
  } catch (e) {
    return handleError(e);
  }
}
