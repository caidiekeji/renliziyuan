import { NextRequest } from 'next/server';
import { ok, fail } from '@/lib/api/response';
import { requireAdmin } from '@/lib/auth/admin';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';

/** 小时工职位报名记录（用户/状态） */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;
  const { id } = await params;

  const job = await prisma.job.findUnique({ where: { id } });
  if (!job) return fail('JOB_NOT_FOUND', '职位不存在', 404);

  const items = await prisma.hourlyJobApplication.findMany({
    where: { job_id: id },
    orderBy: { created_at: 'desc' },
    include: { user: { select: { id: true, name: true, avatar: true, phone: true, title: true, city: true } } },
  });
  return ok(items);
}
