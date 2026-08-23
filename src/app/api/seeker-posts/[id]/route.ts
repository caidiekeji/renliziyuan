import { NextRequest } from 'next/server';
import { ok, fail, handleError } from '@/lib/api/response';
import { getUserFromRequest } from '@/lib/auth/session';
import { prisma } from '@/lib/db/prisma';
import { seekerPostSchema } from '@/lib/validators/zod';
import { sensitiveWordFilter } from '@/lib/sensitive/filter';

export const dynamic = 'force-dynamic';

/** 单条求职信息公开详情（联系方式不返回，需经 /api/call 校验可见性后获取） */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const post = await prisma.seekerPost.findFirst({
    where: { id, status: 'OPEN' },
    include: { user: { select: { id: true, name: true, avatar: true, title: true } } },
  });
  if (!post) return fail('NOT_FOUND', '求职信息不存在', 404);
  return ok({ ...post, show_phone: post.show_phone });
}

/** 更新求职信息（仅本人） */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUserFromRequest();
  if (!user) return fail('UNAUTHORIZED', '未登录', 401);
  const { id } = await params;
  const post = await prisma.seekerPost.findFirst({ where: { id, user_id: user.id } });
  if (!post) return fail('NOT_FOUND', '求职信息不存在', 404);
  const parsed = seekerPostSchema.partial().safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return fail('VALIDATION_ERROR', parsed.error.issues[0]?.message || '参数错误');
  if (parsed.data.title || parsed.data.description) {
    const hit = await sensitiveWordFilter('JOB', `${parsed.data.title || ''} ${parsed.data.description || ''}`);
    if (hit) return fail('SENSITIVE_WORD', `内容包含敏感词「${hit}」`);
  }
  try {
    const updated = await prisma.seekerPost.update({ where: { id }, data: parsed.data });
    return ok(updated);
  } catch (e) {
    return handleError(e);
  }
}

/** 删除/关闭求职信息 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUserFromRequest();
  if (!user) return fail('UNAUTHORIZED', '未登录', 401);
  const { id } = await params;
  const post = await prisma.seekerPost.findFirst({ where: { id, user_id: user.id } });
  if (!post) return fail('NOT_FOUND', '求职信息不存在', 404);
  await prisma.seekerPost.update({ where: { id }, data: { status: 'CLOSED', closed_reason: 'USER_CLOSED' } });
  return ok({ success: true });
}
