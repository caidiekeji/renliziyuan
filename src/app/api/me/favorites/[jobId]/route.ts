import { NextRequest } from 'next/server';
import { ok, fail } from '@/lib/api/response';
import { getUserFromRequest } from '@/lib/auth/session';
import { prisma } from '@/lib/db/prisma';
import { recordUserEvent } from '@/lib/analytics';

/** 收藏职位 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  const user = await getUserFromRequest();
  if (!user) return fail('UNAUTHORIZED', '未登录', 401);
  const { jobId } = await params;
  const job = await prisma.job.findFirst({ where: { id: jobId, deleted_at: null } });
  if (!job) return fail('JOB_NOT_FOUND', '职位不存在', 404);
  await prisma.favorite.upsert({
    where: { user_id_job_id: { user_id: user.id, job_id: jobId } },
    update: {},
    create: { user_id: user.id, job_id: jobId },
  });
  await recordUserEvent(user.id, jobId, 'FAVORITE').catch(() => undefined);
  return ok({ favorited: true });
}

/** 取消收藏 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  const user = await getUserFromRequest();
  if (!user) return fail('UNAUTHORIZED', '未登录', 401);
  const { jobId } = await params;
  await prisma.favorite.deleteMany({ where: { user_id: user.id, job_id: jobId } });
  return ok({ favorited: false });
}
