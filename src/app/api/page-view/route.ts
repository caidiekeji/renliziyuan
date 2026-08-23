import { NextRequest } from 'next/server';
import { ok, fail, getClientIp } from '@/lib/api/response';
import { trackPageView } from '@/lib/analytics';
import { prisma } from '@/lib/db/prisma';
import { getUserFromRequest } from '@/lib/auth/session';
import { reverseGeocode, ipLocation } from '@/lib/geo';

export const dynamic = 'force-dynamic';

/** 埋点上报：页面浏览（含定位 → 省/市） */
export async function POST(req: NextRequest) {
  const user = await getUserFromRequest();
  const body = await req.json().catch(() => ({}));
  const session_id = (body.session_id as string) || '';
  if (!session_id) return fail('VALIDATION_ERROR', '缺少 session_id');
  const path = (body.path as string) || '/';
  const ip = getClientIp(req);

  // 定位解析（lat/lng → 省；无坐标则尝试 IP）
  let province: string | null = null;
  if (body.lat && body.lng) {
    const geo = await reverseGeocode(Number(body.lat), Number(body.lng));
    if (geo) province = geo.province;
  } else if (ip) {
    const loc = await ipLocation(ip);
    if (loc) province = loc.province;
  }

  await trackPageView({
    userId: user?.id || null,
    sessionId: session_id.slice(0, 64),
    path: path.slice(0, 300),
    referer: body.referer || null,
    userAgent: req.headers.get('user-agent'),
    ip,
    durationMs: body.duration_ms ? Number(body.duration_ms) : null,
  });
  await prisma.pageView
    .updateMany({
      where: { session_id: session_id.slice(0, 64), path: path.slice(0, 300), created_at: { gte: new Date(Date.now() - 60000) } },
      data: { province: province || undefined },
    })
    .catch(() => undefined);
  return ok({ success: true });
}
