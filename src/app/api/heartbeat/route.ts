import { NextRequest } from 'next/server';
import { ok, fail, getClientIp } from '@/lib/api/response';
import { getUserFromRequest } from '@/lib/auth/session';
import { ensureRedis } from '@/lib/db/redis';
import { rateLimit } from '@/lib/middleware/rate-limit';

export const dynamic = 'force-dynamic';

/** 在线窗口：最近 10 分钟内有心跳视为在线 */
const ONLINE_WINDOW_SEC = 600;
const ONLINE_SET_KEY = 'online:users';

/**
 * 在线心跳：页面可见期间前端周期性上报。
 * 登录用户写入 Redis ZSET（member=userId, score=当前时间），
 * 并顺手清理超出在线窗口的过期成员，避免集合无限膨胀。
 * Redis 不可用时静默放行（fail-open），在线统计由 dashboard 回退到 PageView 方案。
 */
export async function POST(req: NextRequest) {
  // 心跳频率保护：60 次/分钟/IP（前端 2 分钟一次，余量充足）
  const ip = getClientIp(req);
  const allowed = await rateLimit(`hb:${ip}`, 60, 60);
  if (!allowed) return fail('RATE_LIMITED', '操作过于频繁', 429);

  const body = await req.json().catch(() => ({}));
  const sessionId = typeof body.session_id === 'string' ? body.session_id.slice(0, 64) : '';
  if (!sessionId) return ok({ online: false });

  const user = await getUserFromRequest();
  try {
    const r = await ensureRedis();
    const nowSec = Date.now() / 1000;
    if (user?.id) {
      await r.zadd(ONLINE_SET_KEY, nowSec, user.id);
      await r.zremrangebyscore(ONLINE_SET_KEY, 0, nowSec - ONLINE_WINDOW_SEC);
    }
  } catch {
    // Redis 不可用：静默失败，不影响用户
  }
  return ok({ online: !!user?.id });
}
