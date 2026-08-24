import { NextRequest } from 'next/server';
import { ok, fail } from '@/lib/api/response';
import { requireAdmin, auditLog } from '@/lib/auth/admin';
import { prisma } from '@/lib/db/prisma';
import { getClientIp } from '@/lib/api/response';
import { enqueue } from '@/lib/queue';

export const dynamic = 'force-dynamic';

/** 评价回复审核 / 强制删除 / 修改 */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const review = await prisma.review.findFirst({ where: { id, deleted_at: null } });
  if (!review) return fail('REVIEW_NOT_FOUND', '评价不存在', 404);

  const data: any = {};
  if (body.action === 'approveReply') data.reply_status = 'APPROVED';
  if (body.action === 'rejectReply') data.reply_status = 'REJECTED';
  if (body.content !== undefined) {
    if (typeof body.content !== 'string' || !body.content.trim() || body.content.length > 2000) return fail('VALIDATION_ERROR', '评价内容不合法');
    data.content = body.content;
  }
  if (body.rating !== undefined) {
    const r = Number(body.rating);
    if (!Number.isInteger(r) || r < 1 || r > 5) return fail('VALIDATION_ERROR', '评分必须在 1-5 之间');
    data.rating = r;
  }

  if (Object.keys(data).length) await prisma.review.update({ where: { id }, data });
  await auditLog({ adminId: auth.admin.id, action: body.action || 'UPDATE_REVIEW', targetType: 'REVIEW', targetId: id, detail: body, ip: getClientIp(req) });

  if (review.company_id) await enqueue.recalcRating(review.company_id).catch(() => undefined);
  return ok({ success: true });
}

/** 删除评价 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;
  const { id } = await params;
  const review = await prisma.review.findFirst({ where: { id } });
  if (!review) return fail('REVIEW_NOT_FOUND', '评价不存在', 404);
  await prisma.review.update({ where: { id }, data: { deleted_at: new Date(), deleted_by: auth.admin.id } });
  await auditLog({ adminId: auth.admin.id, action: 'DELETE_REVIEW', targetType: 'REVIEW', targetId: id, ip: getClientIp(req) });
  if (review.company_id) await enqueue.recalcRating(review.company_id).catch(() => undefined);
  return ok({ success: true });
}
