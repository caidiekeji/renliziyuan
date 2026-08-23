import { ensureRedis } from '@/lib/db/redis';
import { log } from '@/lib/logger';

/** Redis INCR + EXPIRE 限流：key 维度每 windowSec 秒最多 limit 次；Redis 不可用时降级放行（fail-open） */
export async function rateLimit(key: string, limit: number, windowSec: number): Promise<boolean> {
  try {
    const r = await ensureRedis();
    const k = `rl:${key}`;
    const count = await r.incr(k);
    if (count === 1) await r.expire(k, windowSec);
    return count <= limit;
  } catch {
    log('warn', 'rate-limit:redis-unavailable', { key });
    return true; // Redis 不可用 → 降级放行，不阻断业务
  }
}

/** 全局限流：按 IP + 路径，公开 GET 100 req/min，登录/验证码 10 req/min */
export async function globalRateLimit(ip: string, path: string, method: string): Promise<boolean> {
  const sensitive = /login|send-code|refresh/.test(path);
  const limit = sensitive ? 10 : 100;
  return rateLimit(`${ip}:${path}:${method}`, limit, 60);
}
