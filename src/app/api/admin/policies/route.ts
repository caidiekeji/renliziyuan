import { NextRequest } from 'next/server';
import { ok, created, fail, handleError, getClientIp } from '@/lib/api/response';
import { requireAdmin, auditLog } from '@/lib/auth/admin';
import { prisma } from '@/lib/db/prisma';
import { policySchema } from '@/lib/validators/zod';

export const dynamic = 'force-dynamic';

/** 条款列表（含 DRAFT，按 key + version 排序） */
export async function GET() {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;
  const items = await prisma.policy.findMany({
    orderBy: [{ key: 'asc' }, { version: 'desc' }],
  });
  return ok(items);
}

/** 新建条款草稿（同一 key 已有版本时 version 自动 +1） */
export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;
  const parsed = policySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return fail('VALIDATION_ERROR', parsed.error.issues[0]?.message || '参数错误');
  const { key, title, content, version } = parsed.data;
  try {
    let v = version;
    if (v == null) {
      const last = await prisma.policy.findFirst({
        where: { key },
        orderBy: { version: 'desc' },
        select: { version: true },
      });
      v = last ? last.version + 1 : 1;
    }
    const item = await prisma.policy.create({
      data: { key, title, content, version: v, status: 'DRAFT', created_by: auth.admin.id },
    });
    await auditLog({ adminId: auth.admin.id, action: 'CREATE_POLICY', targetType: 'POLICY', targetId: item.id, detail: { key, version: v }, ip: getClientIp(req) });
    return created(item);
  } catch (e) {
    return handleError(e);
  }
}
