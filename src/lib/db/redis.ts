import Redis from 'ioredis';

const globalForRedis = globalThis as unknown as { redis?: Redis };

const url = process.env.REDIS_URL || 'redis://localhost:6379';

export const redis: Redis =
  globalForRedis.redis ??
  new Redis(url, {
    maxRetriesPerRequest: null, // BullMQ 需要
    lazyConnect: true,
    enableOfflineQueue: false,
  });

redis.on('error', (e) => console.error('[redis]', e.message));

if (process.env.NODE_ENV !== 'production') globalForRedis.redis = redis;

/** 确保已连接（懒连接） */
export async function ensureRedis(): Promise<Redis> {
  if (redis.status === 'wait') await redis.connect().catch(() => undefined);
  return redis;
}

/** Redis 分布式锁：成功执行并返回回调结果；获取锁失败返回 null */
export async function withLock<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T | null> {
  const r = await ensureRedis();
  const ok = await r.set(key, '1', 'EX', Math.ceil(ttlMs / 1000), 'NX');
  if (!ok) return null;
  try {
    return await fn();
  } finally {
    await r.del(key);
  }
}
