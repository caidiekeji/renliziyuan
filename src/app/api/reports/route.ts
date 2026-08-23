import { NextRequest } from 'next/server';
import { fail, created, handleError } from '@/lib/api/response';
import { getUserFromRequest } from '@/lib/auth/session';
import { prisma } from '@/lib/db/prisma';
import { reportSchema } from '@/lib/validators/zod';

/** 提交举报 */
export async function POST(req: NextRequest) {
  const user = await getUserFromRequest();
  if (!user) return fail('UNAUTHORIZED', '未登录', 401);
  const parsed = reportSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return fail('VALIDATION_ERROR', parsed.error.issues[0]?.message || '参数错误');
  try {
    const report = await prisma.report.create({ data: { reporter_id: user.id, ...parsed.data } });
    return created(report);
  } catch (e) {
    return handleError(e);
  }
}
