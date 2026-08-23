import { NextRequest } from 'next/server';
import { ok, fail, handleError, getClientIp } from '@/lib/api/response';
import { requireAdmin, auditLog } from '@/lib/auth/admin';
import { prisma } from '@/lib/db/prisma';
import { policySchema } from '@/lib/validators/zod';

export const dynamic = 'force-dynamic';

/** 编辑条款草稿（部分字段） */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;
  const { id } = await params;
  const parsed = policySchema.partial().safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return fail('VALIDATION_ERROR', parsed.error.issues[0]?.message || '参数错误');
  try {
    const item = await prisma.policy.update({ where: { id }, data: parsed.data });
    await auditLog({ adminId: auth.admin.id, action: 'UPDATE_POLICY', targetType: 'POLICY', targetId: id, detail: parsed.data, ip: getClientIp(req) });
    return ok(item);
  } catch (e) {
    return handleError(e);
  }
}

/** 删除条款（仅草稿可删） */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;
  const { id } = await params;
  const policy = await prisma.policy.findUnique({ where: { id } });
  if (!policy) return fail('POLICY_NOT_FOUND', '条款不存在', 404);
  if (policy.status !== 'DRAFT') return fail('NOT_DRAFT', '仅草稿可删除');
  try {
    await prisma.policy.delete({ where: { id } });
    await auditLog({ adminId: auth.admin.id, action: 'DELETE_POLICY', targetType: 'POLICY', targetId: id, ip: getClientIp(req) });
    return ok({ success: true });
  } catch (e) {
    return handleError(e);
  }
}
