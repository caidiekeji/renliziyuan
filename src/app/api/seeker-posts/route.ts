import { NextRequest } from 'next/server';
import { ok, fail, created, handleError } from '@/lib/api/response';
import { getUserFromRequest } from '@/lib/auth/session';
import { prisma } from '@/lib/db/prisma';
import { seekerPostSchema } from '@/lib/validators/zod';
import { sensitiveWordFilter } from '@/lib/sensitive/filter';

export const dynamic = 'force-dynamic';

/** 求职信息公开列表（联系方式脱敏） */
export async function GET(req: NextRequest) {
  const city = req.nextUrl.searchParams.get('city');
  const page = Math.max(1, Number(req.nextUrl.searchParams.get('page')) || 1);
  const pageSize = Math.min(50, Math.max(1, Number(req.nextUrl.searchParams.get('pageSize')) || 20));
  const where: any = { status: 'OPEN' };
  if (city && city !== '全国') where.city = city;
  const [total, items] = await Promise.all([
    prisma.seekerPost.count({ where }),
    prisma.seekerPost.findMany({
      where,
      orderBy: { created_at: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { user: { select: { id: true, name: true, avatar: true, title: true } } },
    }),
  ]);
  // 不返回完整手机号（经 /api/call 按会员权限脱敏获取），但透出是否公开电话的标记
  return ok(items.map((p) => ({ ...p, phone: undefined })), { total, page, pageSize });
}

/** 发布求职信息 */
export async function POST(req: NextRequest) {
  const user = await getUserFromRequest();
  if (!user) return fail('UNAUTHORIZED', '未登录', 401);
  const parsed = seekerPostSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return fail('VALIDATION_ERROR', parsed.error.issues[0]?.message || '参数错误');
  const hit = await sensitiveWordFilter('JOB', `${parsed.data.title} ${parsed.data.description || ''}`);
  if (hit) return fail('SENSITIVE_WORD', `内容包含敏感词「${hit}」`);
  try {
    const post = await prisma.seekerPost.create({ data: { user_id: user.id, ...parsed.data } });
    return created(post);
  } catch (e) {
    return handleError(e);
  }
}
