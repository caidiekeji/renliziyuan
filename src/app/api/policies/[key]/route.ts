import { NextRequest } from 'next/server';
import { ok, fail } from '@/lib/api/response';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';

/** 指定条款最新已发布版本（公开） */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const policy = await prisma.policy.findFirst({
    where: { key, status: 'PUBLISHED' },
    orderBy: { version: 'desc' },
  });
  if (!policy) return fail('POLICY_NOT_FOUND', '条款不存在', 404);
  return ok({ key: policy.key, title: policy.title, version: policy.version, content: policy.content, published_at: policy.published_at });
}
