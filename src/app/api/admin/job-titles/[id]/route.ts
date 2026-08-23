import { NextRequest } from 'next/server';
import { ok, fail, handleError, getClientIp } from '@/lib/api/response';
import { requireAdmin, auditLog } from '@/lib/auth/admin';
import { prisma } from '@/lib/db/prisma';
import { jobTitleSchema } from '@/lib/validators/zod';

export const dynamic = 'force-dynamic';

/** 更新职位名称（部分字段） */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;
  const { id } = await params;
  const parsed = jobTitleSchema.partial().safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return fail('VALIDATION_ERROR', parsed.error.issues[0]?.message || '参数错误');
  try {
    const item = await prisma.jobTitle.update({ where: { id }, data: parsed.data });
    await auditLog({ adminId: auth.admin.id, action: 'UPDATE_JOB_TITLE', targetType: 'JOB_TITLE', targetId: id, detail: parsed.data, ip: getClientIp(req) });
    return ok(item);
  } catch (e) {
    return handleError(e);
  }
}

/** 删除职位名称（存在职位引用则软下线） */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;
  const { id } = await params;
  const used = await prisma.job.count({ where: { job_title_id: id } });
  if (used > 0) {
    await prisma.jobTitle.update({ where: { id }, data: { active: false } });
    await auditLog({ adminId: auth.admin.id, action: 'DISABLE_JOB_TITLE', targetType: 'JOB_TITLE', targetId: id, ip: getClientIp(req) });
    return ok({ success: true, note: '职位名称已被职位引用，已改为下线' });
  }
  try {
    await prisma.jobTitle.delete({ where: { id } });
    await auditLog({ adminId: auth.admin.id, action: 'DELETE_JOB_TITLE', targetType: 'JOB_TITLE', targetId: id, ip: getClientIp(req) });
    return ok({ success: true });
  } catch (e) {
    return handleError(e);
  }
}
