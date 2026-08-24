import { NextRequest } from 'next/server';
import { ok, fail } from '@/lib/api/response';
import { sendVerificationCode } from '@/lib/sms';
import { sendCodeSchema } from '@/lib/validators/zod';
import { getClientIp } from '@/lib/api/response';
import { globalRateLimit } from '@/lib/middleware/rate-limit';

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  if (!(await globalRateLimit(ip, '/api/auth/send-code', 'POST')))
    return fail('RATE_LIMITED', '请求过于频繁，请稍后再试', 429);

  const parsed = sendCodeSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return fail('VALIDATION_ERROR', parsed.error.issues[0]?.message || '参数错误');

  const result = await sendVerificationCode(parsed.data.phone, parsed.data.purpose);
  if (!result.ok) return fail('SMS_SEND_FAILED', result.message);
  // 验证码仅通过短信下发。仅开发模式（SMS_DEV_MODE=1）回传供本地/e2e 联调；生产环境绝不返回验证码
  return ok({ message: result.message, ...(process.env.SMS_DEV_MODE === '1' ? { code: result.code } : {}) });
}
