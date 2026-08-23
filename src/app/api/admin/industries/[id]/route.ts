import { NextRequest } from 'next/server';
import { ok, fail, handleError, getClientIp } from '@/lib/api/response';
import { requireAdmin, auditLog } from '@/lib/auth/admin';
import { prisma } from '@/lib/db/prisma';
import { industrySchema } from '@/lib/validators/zod';

export const dynamic = 'force-dynamic';

/** 更新行业（部分字段） */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;
  const { id } = await params;
  const parsed = industrySchema.partial().safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return fail('VALIDATION_ERROR', parsed.error.issues[0]?.message || '参数错误');
  try {
    const industry = await prisma.industry.update({ where: { id }, data: parsed.data });
    await auditLog({ adminId: auth.admin.id, action: 'UPDATE_INDUSTRY', targetType: 'INDUSTRY', targetId: id, detail: parsed.data, ip: getClientIp(req) });
    return ok(industry);
  } catch (e) {
    return handleError(e);
  }
}

/** 删除行业（存在子行业或职位引用时拒绝） */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;
  const { id } = await params;
  const [children, jobs] = await Promise.all([
    prisma.industry.count({ where: { parent_id: id } }),
    prisma.job.count({ where: { industry_id: id } }),
  ]);
  if (children > 0 || jobs > 0) return fail('HAS_CHILDREN', '存在子分类');
  try {
    await prisma.industry.delete({ where: { id } });
    await auditLog({ adminId: auth.admin.id, action: 'DELETE_INDUSTRY', targetType: 'INDUSTRY', targetId: id, ip: getClientIp(req) });
    return ok({ success: true });
  } catch (e) {
    return handleError(e);
  }
}
