import { ok, fail } from '@/lib/api/response';
import { getUserFromRequest } from '@/lib/auth/session';
import { signAccessToken } from '@/lib/auth/jwt';

export const dynamic = 'force-dynamic';

/** 为实时聊天签发 socket 认证 token（复用当前登录会话身份） */
export async function GET() {
  const user = await getUserFromRequest();
  if (!user) return fail('UNAUTHORIZED', '未登录', 401);
  const token = await signAccessToken(user.id, user.refresh_token_version, user.role);
  return ok({ token });
}
