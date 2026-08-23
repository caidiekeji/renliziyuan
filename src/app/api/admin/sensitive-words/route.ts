import { NextRequest } from 'next/server';
import { ok, created, fail, handleError, getClientIp } from '@/lib/api/response';
import { requireAdmin, auditLog } from '@/lib/auth/admin';
import { prisma } from '@/lib/db/prisma';
import { sensitiveWordSchema } from '@/lib/validators/zod';

export const dynamic = 'force-dynamic';

/** 敏感词列表（keyword 过滤，分页） */
export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;
  const url = req.nextUrl;
  const keyword = url.searchParams.get('keyword')?.trim();
  const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get('pageSize')) || 20));

  const where: any = {};
  if (keyword) {
    where.OR = [
      { word: { contains: keyword, mode: 'insensitive' } },
      { category: { contains: keyword, mode: 'insensitive' } },
    ];
  }
  const [total, items] = await Promise.all([
    prisma.sensitiveWord.count({ where }),
    prisma.sensitiveWord.findMany({
      where,
      orderBy: { created_at: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);
  return ok(items, { total, page, pageSize });
}

/** 新增敏感词 */
export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;
  const parsed = sensitiveWordSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return fail('VALIDATION_ERROR', parsed.error.issues[0]?.message || '参数错误');
  try {
    const item = await prisma.sensitiveWord.create({ data: parsed.data });
    await auditLog({ adminId: auth.admin.id, action: 'CREATE_SENSITIVE_WORD', targetType: 'SENSITIVE_WORD', targetId: item.id, detail: parsed.data, ip: getClientIp(req) });
    return created(item);
  } catch (e) {
    return handleError(e);
  }
}
