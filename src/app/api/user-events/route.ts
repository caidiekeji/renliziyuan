import { NextRequest } from 'next/server';
import { ok, fail } from '@/lib/api/response';
import { getUserFromRequest } from '@/lib/auth/session';
import { recordUserEvent } from '@/lib/analytics';

export const dynamic = 'force-dynamic';

/** 显式行为事件上报（浏览/收藏/沟通），用于推荐学习 */
export async function POST(req: NextRequest) {
  const user = await getUserFromRequest();
  if (!user) return fail('UNAUTHORIZED', '未登录', 401);
  const { job_id, event_type } = await req.json().catch(() => ({}));
  if (!job_id || !['VIEW', 'FAVORITE', 'CHAT'].includes(event_type))
    return fail('VALIDATION_ERROR', '参数错误');
  await recordUserEvent(user.id, job_id, event_type);
  return ok({ success: true });
}
