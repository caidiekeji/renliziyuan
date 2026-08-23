import { NextRequest } from 'next/server';
import { ok, fail } from '@/lib/api/response';
import { getUserFromRequest } from '@/lib/auth/session';
import { prisma } from '@/lib/db/prisma';
import { withinRadius } from '@/lib/recommend/score';
import { cityCoord } from '@/lib/geo';
import { getSiteConfig } from '@/lib/config';

export const dynamic = 'force-dynamic';

/** 附近职位：定位或指定城市为中心，半径内职位 */
export async function GET(req: NextRequest) {
  const user = await getUserFromRequest();
  const cfg = await getSiteConfig();
  const url = req.nextUrl;
  const city = url.searchParams.get('city');
  const lat = url.searchParams.get('lat');
  const lng = url.searchParams.get('lng');
  const radius = Number(url.searchParams.get('radius')) || cfg.nearby_radius_km;

  let center: { lat: number; lng: number } | null = null;
  if (lat && lng) {
    center = { lat: Number(lat), lng: Number(lng) };
  } else if (city) {
    center = await cityCoord(city);
  } else if (user?.city) {
    center = await cityCoord(user.city);
  }
  if (!center) return fail('LOCATION_REQUIRED', '缺少定位信息或城市中心坐标', 400);

  const jobs = await prisma.job.findMany({
    where: { status: 'OPEN', audit_status: 'APPROVED', deleted_at: null, lat: { not: null }, lng: { not: null } },
    take: 500,
    include: { company: { select: { id: true, name: true, logo: true } } },
  });
  const nearby = jobs
    .filter((j) => withinRadius(j as any, center!.lat, center!.lng, radius))
    .sort((a, b) => {
      const da = dist(a, center!);
      const db = dist(b, center!);
      return da - db;
    });
  return ok(nearby, { center, radius, total: nearby.length });
}

function dist(job: any, c: { lat: number; lng: number }) {
  return Math.pow(Number(job.lat) - c.lat, 2) + Math.pow(Number(job.lng) - c.lng, 2);
}
