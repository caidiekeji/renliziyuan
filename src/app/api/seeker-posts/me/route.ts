import { ok, fail } from '@/lib/api/response';
import { getUserFromRequest } from '@/lib/auth/session';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';

/** 我发布的求职信息 */
export async function GET() {
  const user = await getUserFromRequest();
  if (!user) return fail('UNAUTHORIZED', '未登录', 401);
  const posts = await prisma.seekerPost.findMany({
    where: { user_id: user.id },
    orderBy: { created_at: 'desc' },
  });
  return ok(posts);
}
