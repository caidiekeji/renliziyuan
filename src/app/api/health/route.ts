import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';

/** 健康检查：返回服务/Database/Redis 状态（供负载均衡与探活） */
export async function GET() {
  const status: Record<string, string> = { status: 'ok' };
  let code = 200;

  try {
    await prisma.$queryRaw`SELECT 1`;
    status.database = 'ok';
  } catch {
    status.database = 'error';
    status.status = 'degraded';
    code = 503;
  }

  try {
    const { ensureRedis } = await import('@/lib/db/redis');
    const redis = await ensureRedis();
    const pong = await redis.ping();
    status.redis = pong === 'PONG' ? 'ok' : 'error';
    if (pong !== 'PONG') {
      status.status = 'degraded';
      code = 503;
    }
  } catch {
    status.redis = 'error';
    status.status = 'degraded';
    code = 503;
  }

  return NextResponse.json(status, { status: code });
}