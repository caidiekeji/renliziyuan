import { NextRequest } from 'next/server';
import { ok, fail, getClientIp } from '@/lib/api/response';
import { resetPasswordSchema } from '@/lib/validators/zod';
import { verifyCode } from '@/lib/sms';
import { prisma } from '@/lib/db/prisma';
import { globalRateLimit } from '@/lib/middleware/rate-limit';
import bcrypt from 'bcryptjs';

// 找回密码：凭手机号 + 短信验证码（purpose=RESET）重置密码，并使全部 refresh_token 失效
export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  if (!(await globalRateLimit(ip, '/api/auth/reset-password', 'POST')))
    return fail('RATE_LIMITED', '请求过于频繁', 429);

  const parsed = resetPasswordSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return fail('VALIDATION_ERROR', parsed.error.issues[0]?.message || '参数错误');
  const { phone, code, password } = parsed.data;

  const codeOk = await verifyCode(phone, code, 'RESET');
  if (!codeOk) return fail('INVALID_CODE', '验证码错误或已过期');

  const user = await prisma.user.findUnique({ where: { phone } });
  if (!user || user.status === 'DELETED') return fail('USER_NOT_FOUND', '该手机号未注册或已注销');
  if (user.status === 'BANNED') return fail('USER_BANNED', '账号已被封禁');

  const password_hash = await bcrypt.hash(password, 10);
  await prisma.user.update({
    where: { id: user.id },
    data: { password_hash, refresh_token_version: { increment: 1 } },
  });

  return ok({ success: true, message: '密码已重置，请重新登录' });
}