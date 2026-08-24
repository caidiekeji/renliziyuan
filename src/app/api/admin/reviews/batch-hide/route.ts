import { NextRequest } from 'next/server';
import { ok, fail } from '@/lib/api/response';
import { requireAdmin, auditLog } from '@/lib/auth/admin';
import { prisma } from '@/lib/db/prisma';
import { getClientIp } from '@/lib/api/response';
import { enqueue } from '@/lib/queue';

export const dynamic = 'force-dynamic';

/** 异常评分批量隐藏（软删，不影响历史引用；同时重算受影响企业评分） */
export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;
  const body = await req.json().catch(() => ({}));
  const ids = Array.isArray(body?.ids) ? body.ids.filter((v: unknown) => typeof v === 'string') : [];
  if (!ids.length) return fail('VALIDATION_ERROR', '缺少 ids');
  if (ids.length > 100) return fail('VALIDATION_ERROR', '单次最多处理 100 条');

  const affected = await prisma.review.findMany({
    where: { id: { in: ids }, deleted_at: null },
    select: { id: true, company_id: true },
  });
  if (!affected.length) return fail('REVIEW_NOT_FOUND', '未找到可隐藏的评价');

  const { count } = await prisma.review.updateMany({
    where: { id: { in: affected.map((r) => r.id) }, deleted_at: null },
    data: { deleted_at: new Date(), deleted_by: auth.admin.id },
  });

  // 受影响企业评分重算（幂等队列任务）
  const companyIds = [...new Set(affected.map((r) => r.company_id).filter((v): v is string => !!v))];
  await Promise.all(companyIds.map((cid) => enqueue.recalcRating(cid).catch(() => undefined)));

  await auditLog({
    adminId: auth.admin.id,
    action: 'BATCH_HIDE_REVIEWS',
    targetType: 'REVIEW',
    detail: { ids: affected.map((r) => r.id), count },
    ip: getClientIp(req),
  });
  return ok({ hidden: count });
}
