import { NextRequest } from 'next/server';
import { ok, fail, handleError } from '@/lib/api/response';
import { getUserFromRequest } from '@/lib/auth/session';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';

type JobRow = { id: string; is_hourly: boolean; applied_count: number; slots: number; status: string };

/**
 * 报名小时工职位（v2.0/v2.6）
 * - 仅当 is_hourly=true 且 applied_count < slots 时可报名
 * - 同一用户不可重复报名（唯一约束 job_id+user_id）
 * - 事务内 SELECT ... FOR UPDATE 锁定 jobs 行，防止超卖
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUserFromRequest();
  if (!user) return fail('UNAUTHORIZED', '未登录', 401);
  if (user.role === 'ADMIN') return fail('FORBIDDEN', '管理员不可报名小时工', 403);
  const { id } = await params;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const rows = (await tx.$queryRaw`
        SELECT id, is_hourly, applied_count, slots, status FROM "Job" WHERE id = ${id}::uuid FOR UPDATE
      `) as unknown as JobRow[];
      const job = rows[0];
      if (!job || job.status !== 'OPEN') return { error: fail('JOB_NOT_FOUND', '职位不存在或已下线', 404) };
      if (!job.is_hourly) return { error: fail('NOT_HOURLY', '该职位非小时工，无需报名', 400) };
      if (job.applied_count >= job.slots)
        return { error: fail('SLOTS_FULL', '报名人数已满', 409) };

      const existing = await tx.hourlyJobApplication.findUnique({
        where: { job_id_user_id: { job_id: id, user_id: user.id } },
      });
      if (existing && existing.status === 'APPLIED') return { error: fail('ALREADY_APPLIED', '您已报名该职位', 409) };

      const app = existing && existing.status === 'CANCELLED'
        ? await tx.hourlyJobApplication.update({
            where: { id: existing.id },
            data: { status: 'APPLIED' },
          })
        : await tx.hourlyJobApplication.create({
            data: { job_id: id, user_id: user.id, status: 'APPLIED' },
          });

      await tx.job.update({
        where: { id },
        data: { applied_count: { increment: 1 } },
      });
      return { data: app };
    });

    if ('error' in result) return result.error;
    return ok(result.data, { message: '报名成功' });
  } catch (e) {
    return handleError(e);
  }
}

/** 取消报名（v2.3/v2.6）：任意状态均可取消，保留记录不物理删除，applied_count 事务内减 1 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUserFromRequest();
  if (!user) return fail('UNAUTHORIZED', '未登录', 401);
  const { id } = await params;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const rows = (await tx.$queryRaw`
        SELECT id, applied_count, slots FROM "Job" WHERE id = ${id}::uuid FOR UPDATE
      `) as unknown as JobRow[];
      const job = rows[0];
      if (!job) return { error: fail('JOB_NOT_FOUND', '职位不存在', 404) };

      const app = await tx.hourlyJobApplication.findUnique({
        where: { job_id_user_id: { job_id: id, user_id: user.id } },
      });
      if (!app || app.status === 'CANCELLED') return { error: fail('NOT_APPLIED', '您尚未报名该职位', 404) };

      const updated = await tx.hourlyJobApplication.update({
        where: { id: app.id },
        data: { status: 'CANCELLED' },
      });
      await tx.job.update({
        where: { id },
        data: { applied_count: Math.max(0, job.applied_count - 1) },
      });
      return { data: updated };
    });

    if ('error' in result) return result.error;
    return ok(result.data, { message: '已取消报名' });
  } catch (e) {
    return handleError(e);
  }
}
