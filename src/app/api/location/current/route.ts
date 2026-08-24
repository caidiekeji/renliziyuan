import { NextRequest } from 'next/server';
import { ok, fail, getClientIp } from '@/lib/api/response';
import { reverseGeocode, ipLocation, haversineKm } from '@/lib/geo';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';

/** 去掉行政后缀后与城市库名称前缀匹配（如 "北京市" → "北京"），无匹配返回 null */
async function matchCity(raw: string): Promise<{ name: string; province: string | null } | null> {
  const cityName = raw.replace(/(市|地区|自治州|盟)$/, '').trim();
  if (!cityName) return null;
  return prisma.city.findFirst({
    where: { name: { startsWith: cityName } },
    select: { name: true, province: true },
  });
}

/** 城市库全量缓存（10 分钟），用于"最近城市"兜底 */
let cityCache: { at: number; rows: { name: string; province: string | null; lat: number; lng: number }[] } | null = null;

/** 逆地理全部失败/无匹配时，取城市库最近城市兜底（80km 内），保证"永远能给到城市"（设计方案 2.9 降级链路） */
async function nearestCity(lat: number, lng: number): Promise<{ name: string; province: string | null } | null> {
  if (!cityCache || Date.now() - cityCache.at > 10 * 60 * 1000) {
    const rows = await prisma.city.findMany({ select: { name: true, province: true, lat: true, lng: true } });
    cityCache = {
      at: Date.now(),
      rows: rows.map((r) => ({ name: r.name, province: r.province, lat: Number(r.lat), lng: Number(r.lng) })),
    };
  }
  let best: { name: string; province: string | null } | null = null;
  let bestKm = Infinity;
  for (const c of cityCache.rows) {
    if (!Number.isFinite(c.lat) || !Number.isFinite(c.lng)) continue;
    // 城市库为 GCJ-02、浏览器为 WGS-84，偏差百米级，不影响市粒度判断
    const km = haversineKm(lat, lng, c.lat, c.lng);
    if (km < bestKm) {
      bestKm = km;
      best = c;
    }
  }
  return bestKm <= 80 ? best : null;
}

/**
 * 解析当前城市（与城市库匹配）。
 * GET /api/location/current?lat=..&lng=.. —— 浏览器定位逆地理编码（精确），无匹配时最近城市兜底
 * GET /api/location/current —— IP 定位（XXAPI 主/百度兜底），市级→县级→省级回落逆地理
 * 返回 { city, province, lat?, lng? }；均无匹配时 city 为 null。
 */
export async function GET(req: NextRequest) {
  const latRaw = req.nextUrl.searchParams.get('lat');
  const lngRaw = req.nextUrl.searchParams.get('lng');
  const hasCoord = latRaw !== null && lngRaw !== null && latRaw !== '' && lngRaw !== '';

  if (hasCoord) {
    const lat = Number(latRaw);
    const lng = Number(lngRaw);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return fail('INVALID_PARAM', '经纬度参数无效', 400);
    const geo = await reverseGeocode(lat, lng);
    let city = await matchCity(geo?.city || '');
    if (!city) city = await nearestCity(lat, lng);
    return ok(city ? { city: city.name, province: city.province || geo?.province || '' } : { city: null, province: geo?.province || '' });
  }

  // ip 参数优先（客户端通过 ipify 检测的出口 IP），无则走服务端代理头/remoteAddress
  // 校验：仅接受公网 IPv4，拒绝私网/保留/环回地址（防内网地址探测）
  const ip = req.nextUrl.searchParams.get('ip') || getClientIp(req);
  const ipv4 = /^(\d{1,3}\.){3}\d{1,3}$/.test(ip);
  if (!ipv4 || ip === '127.0.0.1' || ip === '::1') return fail('INVALID_PARAM', 'IP 参数无效', 400);
  const parts = ip.split('.').map(Number);
  const isPrivate =
    parts[0] === 10 ||
    parts[0] === 127 ||
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
    (parts[0] === 192 && parts[1] === 168) ||
    parts[0] === 0 ||
    parts[0] >= 224;
  if (isPrivate) return fail('INVALID_PARAM', 'IP 参数无效', 400);
  const loc = await ipLocation(ip);
  // 市级 → 县级（部分 IP 库粒度到县级市）→ 省级时回落逆地理（数据中心 IP 场景）
  let city = loc ? await matchCity(loc.city || '') : null;
  if (!city && loc?.county) city = await matchCity(loc.county);
  if (!city && loc && loc.lat !== undefined && loc.lng !== undefined) {
    const geo = await reverseGeocode(loc.lat, loc.lng);
    city = await matchCity(geo?.city || '');
  }
  const coords = loc && loc.lat !== undefined && loc.lng !== undefined ? { lat: loc.lat, lng: loc.lng } : {};
  return ok(
    city
      ? { city: city.name, province: city.province || loc?.province || '', ...coords }
      : { city: null, province: loc?.province || '', ...coords }
  );
}
