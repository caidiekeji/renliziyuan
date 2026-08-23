import { NextRequest } from 'next/server';
import { ok, fail } from '@/lib/api/response';
import { prisma } from '@/lib/db/prisma';
import { getUserFromRequest } from '@/lib/auth/session';
import { sha256 } from '@/lib/crypto';

export const dynamic = 'force-dynamic';

/** 检测当前用户是否已同意指定条款的最新发布版本（登录后弹窗重新同意用） */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const user = await getUserFromRequest();
  if (!user) return fail('UNAUTHORIZED', '未登录', 401);
  const { key } = await params;

  const policy = await prisma.policy.findFirst({
    where: { key, status: 'PUBLISHED' },
    orderBy: { version: 'desc' },
  });
  if (!policy) return ok({ key, latest_version: null, agreed_version: null, needs_agreement: false });

  const latest = await prisma.userPolicyAgreement.findFirst({
    where: { user_id: user.id, policy_key: key },
    orderBy: { agreed_at: 'desc' },
  });
  const agreed = !!latest && latest.version >= policy.version && latest.content_hash === sha256(policy.content);

  return ok({
    key,
    latest_version: policy.version,
    agreed_version: latest?.version ?? null,
    needs_agreement: !agreed,
  });
}