import { NextRequest } from 'next/server';
import { ok, fail, handleError, getClientIp } from '@/lib/api/response';
import { requireAdmin, auditLog } from '@/lib/auth/admin';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';

/** 发布条款（草稿 → PUBLISHED） */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;
  const { id } = await params;
  const policy = await prisma.policy.findUnique({ where: { id } });
  if (!policy) return fail('POLICY_NOT_FOUND', '条款不存在', 404);
  try {
    const now = new Date();
    const item = await prisma.policy.update({
      where: { id },
      data: {
        status: 'PUBLISHED',
        published_at: now,
        published_by: auth.admin.id,
        effective_from: now,
      },
    });
    await auditLog({ adminId: auth.admin.id, action: 'PUBLISH_POLICY', targetType: 'POLICY', targetId: id, detail: { key: policy.key, version: policy.version }, ip: getClientIp(req) });
    return ok(item);
  } catch (e) {
    return handleError(e);
  }
}
