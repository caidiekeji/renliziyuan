import { NextRequest } from 'next/server';
import { ok, fail } from '@/lib/api/response';
import { requireAdmin, auditLog } from '@/lib/auth/admin';
import { prisma } from '@/lib/db/prisma';
import { getClientIp } from '@/lib/api/response';
import { notifyUser } from '@/lib/notification';

export const dynamic = 'force-dynamic';

/** 职位审核（通过/驳回）/ 下线 / 恢复 / 人工加权 */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const job = await prisma.job.findFirst({ where: { id } });
  if (!job) return fail('JOB_NOT_FOUND', '职位不存在', 404);

  const data: any = {};
  // 审核
  if (body.action === 'approve') {
    data.audit_status = 'APPROVED';
    data.status = 'OPEN';
    data.closed_reason = null;
  } else if (body.action === 'reject') {
    data.audit_status = 'REJECTED';
    data.status = 'CLOSED';
    data.closed_reason = 'AUDIT_REJECTED';
  } else if (body.action === 'offline') {
    data.status = 'CLOSED';
    data.closed_reason = 'ADMIN';
  } else if (body.action === 'restore') {
    data.deleted_at = null;
    data.status = 'OPEN';
    data.closed_reason = null;
  }
  // 人工加权/降权/强制曝光
  if (body.boost !== undefined || body.forced !== undefined) {
    await prisma.jobBoost.upsert({
      where: { job_id: id },
      update: { boost: body.boost ?? 0, forced: body.forced ?? false },
      create: { job_id: id, boost: body.boost ?? 0, forced: body.forced ?? false },
    });
  }
  // 黑名单
  if (body.blacklist === true) await prisma.recommendationBlacklist.upsert({ where: { job_id: id }, update: {}, create: { job_id: id } });
  if (body.blacklist === false) await prisma.recommendationBlacklist.deleteMany({ where: { job_id: id } });

  if (Object.keys(data).length) {
    await prisma.job.update({ where: { id }, data });
  }
  await auditLog({ adminId: auth.admin.id, action: body.action || 'BOOST_JOB', targetType: 'JOB', targetId: id, detail: body, ip: getClientIp(req) });

  // 通知企业（审核结果）
  if (body.action === 'approve' || body.action === 'reject') {
    const company = await prisma.company.findUnique({ where: { id: job.company_id } });
    if (company) {
      await notifyUser({
        userId: company.owner_id,
        type: 'JOB_AUDIT',
        title: body.action === 'approve' ? '职位审核通过' : '职位审核未通过',
        body: `「${job.title}」${body.action === 'approve' ? '已上线' : '已被驳回'}`,
        link: '/company/jobs',
      });
    }
  }
  return ok({ success: true });
}

/** 删除职位（管理） */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;
  const { id } = await params;
  const job = await prisma.job.findUnique({ where: { id } });
  if (!job) return fail('JOB_NOT_FOUND', '职位不存在', 404);
  await prisma.job.update({ where: { id }, data: { deleted_at: new Date(), status: 'CLOSED', closed_reason: 'ADMIN' } });
  await auditLog({ adminId: auth.admin.id, action: 'DELETE_JOB', targetType: 'JOB', targetId: id, ip: getClientIp(req) });
  return ok({ success: true });
}
