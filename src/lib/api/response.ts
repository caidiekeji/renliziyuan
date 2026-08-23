import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

export function ok<T>(data: T, meta?: Record<string, unknown>): NextResponse {
  return NextResponse.json(meta ? { data, ...meta } : { data });
}

export function created<T>(data: T): NextResponse {
  return NextResponse.json({ data }, { status: 201 });
}

export function fail(code: string, message: string, status = 400): NextResponse {
  return NextResponse.json({ error: code, message }, { status });
}

export function handleError(e: unknown, fallback = '服务器内部错误'): NextResponse {
  if (e instanceof ZodError) {
    return fail('VALIDATION_ERROR', e.issues[0]?.message || '参数校验失败');
  }
  const err = e as { message?: string };
  if (err?.message?.startsWith('ZodError')) return fail('VALIDATION_ERROR', '参数校验失败');
  return fail('INTERNAL', err?.message || fallback, 500);
}

export async function readJson(req: Request): Promise<any> {
  try {
    return await req.json();
  } catch {
    return {};
  }
}

export function getClientIp(req: Request): string {
  // 仅在声明位于可信反向代理之后(TRUST_PROXY=1)时才信任代理头，避免客户端伪造 X-Forwarded-For 绕过限流
  if (process.env.TRUST_PROXY === '1') {
    const xff = req.headers.get('x-forwarded-for');
    if (xff) return xff.split(',')[0].trim();
  }
  return req.headers.get('x-real-ip')?.trim() || '';
}
