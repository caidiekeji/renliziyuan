import { NextRequest } from 'next/server';
import { ok, created, fail, handleError, getClientIp } from '@/lib/api/response';
import { requireAdmin, auditLog } from '@/lib/auth/admin';
import { prisma } from '@/lib/db/prisma';
import { industrySchema } from '@/lib/validators/zod';

export const dynamic = 'force-dynamic';

/** 行业列表（含 inactive，树形） */
export async function GET() {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;
  const list = await prisma.industry.findMany({
    orderBy: [{ sort: 'desc' }, { name: 'asc' }],
  });
  const byParent = new Map<string, typeof list>();
  for (const item of list) {
    const key = item.parent_id ?? '';
    byParent.set(key, [...(byParent.get(key) || []), item]);
  }
  const build = (parentId: string | null): any[] =>
    (byParent.get(parentId ?? '') || []).map((item) => ({ ...item, children: build(item.id) }));
  return ok(build(null));
}

/** 新增行业 */
export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;
  const parsed = industrySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return fail('VALIDATION_ERROR', parsed.error.issues[0]?.message || '参数错误');
  try {
    if (parsed.data.parent_id) {
      const parent = await prisma.industry.findUnique({ where: { id: parsed.data.parent_id } });
      if (!parent) return fail('PARENT_NOT_FOUND', '父行业不存在');
    }
    const industry = await prisma.industry.create({ data: parsed.data });
    await auditLog({ adminId: auth.admin.id, action: 'CREATE_INDUSTRY', targetType: 'INDUSTRY', targetId: industry.id, detail: parsed.data, ip: getClientIp(req) });
    return created(industry);
  } catch (e) {
    return handleError(e);
  }
}
