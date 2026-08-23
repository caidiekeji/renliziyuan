import { NextRequest } from 'next/server';
import { ok, created, fail, handleError, getClientIp } from '@/lib/api/response';
import { requireAdmin, auditLog } from '@/lib/auth/admin';
import { prisma } from '@/lib/db/prisma';
import { jobTitleSchema } from '@/lib/validators/zod';

export const dynamic = 'force-dynamic';

/** 职位名称列表（可按 category/keyword 过滤，分页） */
export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;
  const url = req.nextUrl;
  const category = url.searchParams.get('category')?.trim();
  const keyword = url.searchParams.get('keyword')?.trim();
  const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get('pageSize')) || 20));

  const where: any = {};
  if (category) where.category = category;
  if (keyword) {
    where.OR = [
      { name: { contains: keyword, mode: 'insensitive' } },
      { code: { contains: keyword, mode: 'insensitive' } },
      { sub_category: { contains: keyword, mode: 'insensitive' } },
    ];
  }
  const [total, items] = await Promise.all([
    prisma.jobTitle.count({ where }),
    prisma.jobTitle.findMany({
      where,
      orderBy: [{ category: 'asc' }, { sort: 'desc' }, { name: 'asc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);
  return ok(items, { total, page, pageSize });
}

/** 新增职位名称 */
export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;
  const parsed = jobTitleSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return fail('VALIDATION_ERROR', parsed.error.issues[0]?.message || '参数错误');
  try {
    const item = await prisma.jobTitle.create({ data: parsed.data });
    await auditLog({ adminId: auth.admin.id, action: 'CREATE_JOB_TITLE', targetType: 'JOB_TITLE', targetId: item.id, detail: parsed.data, ip: getClientIp(req) });
    return created(item);
  } catch (e) {
    return handleError(e);
  }
}
