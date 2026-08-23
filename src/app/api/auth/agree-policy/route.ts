import { NextRequest } from 'next/server';
import { ok, fail, getClientIp } from '@/lib/api/response';
import { prisma } from '@/lib/db/prisma';
import { getUserFromRequest } from '@/lib/auth/session';
import { sha256 } from '@/lib/crypto';

// 重新同意条款（登录后 / 应用内弹窗）——记录到 user_policy_agreements
export async function POST(req: NextRequest) {
  const user = await getUserFromRequest();
  if (!user) return fail('UNAUTHORIZED', '未登录', 401);

  const body = await req.json().catch(() => ({}));
  const key = typeof body?.key === 'string' ? body.key : null;
  if (!key) return fail('VALIDATION_ERROR', '缺少条款 key');
  const source = body.source === 'IN_APP_PROMPT' ? 'IN_APP_PROMPT' : 'LOGIN';

  const policy = await prisma.policy.findFirst({
    where: { key, status: 'PUBLISHED' },
    orderBy: { version: 'desc' },
  });
  if (!policy) return fail('POLICY_NOT_FOUND', '条款不存在', 404);

  await prisma.userPolicyAgreement.create({
    data: {
      user_id: user.id,
      policy_key: key,
      policy_id: policy.id,
      version: policy.version,
      content_hash: sha256(policy.content),
      ip: getClientIp(req),
      user_agent: req.headers.get('user-agent')?.slice(0, 300) || undefined,
      source,
    },
  });

  return ok({ success: true, key, version: policy.version });
}