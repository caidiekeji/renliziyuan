import { NextRequest } from 'next/server';
import { ok, fail, handleError } from '@/lib/api/response';
import { requireAdmin, auditLog } from '@/lib/auth/admin';
import { prisma } from '@/lib/db/prisma';
import { getClientIp } from '@/lib/api/response';

export const dynamic = 'force-dynamic';

/** 推荐黑名单列表（分页，含职位信息） */
export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;
  const page = Math.max(1, Number(req.nextUrl.searchParams.get('page')) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(req.nextUrl.searchParams.get('pageSize')) || 20));
  const [total, items] = await Promise.all([
    prisma.recommendationBlacklist.count(),
    prisma.recommendationBlacklist.findMany({
      orderBy: { created_at: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        job: { select: { id: true, title: true, city: true, company: { select: { id: true, name: true } } } },
      },
    }),
  ]);
  return ok(items, { total, page, pageSize });
}

/** 加入推荐黑名单（按 job_id） */
export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;
  const { job_id } = await req.json().catch(() => ({}));
  if (!job_id || typeof job_id !== 'string') return fail('VALIDATION_ERROR', '缺少 job_id');
  const job = await prisma.job.findUnique({ where: { id: job_id } });
  if (!job) return fail('JOB_NOT_FOUND', '职位不存在', 404);
  try {
    const item = await prisma.recommendationBlacklist.upsert({
      where: { job_id },
      update: {},
      create: { job_id },
    });
    await auditLog({ adminId: auth.admin.id, action: 'BLACKLIST_JOB', targetType: 'JOB', targetId: job_id, ip: getClientIp(req) });
    return ok(item);
  } catch (e: any) {
    if (e?.code === 'P2002') return fail('ALREADY_BLACKLISTED', '该职位已在黑名单');
    return handleError(e);
  }
}
